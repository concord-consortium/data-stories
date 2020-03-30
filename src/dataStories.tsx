import React, {Component} from 'react';
import codapInterface from "./lib/CodapInterface";
import {initializePlugin} from './lib/codap-helper';
import {Timeline} from './timeline';
import {MomentView, Moment} from './moment';
import './dataStories.css';

import shutterImage from "./art/shutter.png";

const kPluginName = "Story Builder";
const kInitialMarkerStartDelay = 1200;      //  milliseconds
const kNarrativeTextBoxName = "narrative";
const kMagnifyingGlass = "\ud83d\udd0d";
const kCheckmark = "\u2714";
const kTrashCan = "\uD83D\uddd1";
const kSeparatorString = "\n\n";

const kVersion = "0.2";
const kInitialWideDimensions = {
	width: 800,
	height: 100
};
const kInitialTallDimensions = {
	width: 333,
	height: 555
};

function Credits(props : any) {
    return (
        <div id={"credits"}>
            <div>Some icons made by <a href="https://www.flaticon.com/authors/fjstudio" title="fjstudio">fjstudio</a> from <a href="https://www.flaticon.com/" title="Flaticon">www.flaticon.com</a></div>
        </div>
    )
}

/**
 * If necessary, create a text component to hold information about the
 * current marker's Moment, principally any narrative text the student has written.
 *
 * Called as `window.onload` because we want to delay checking until any pre-existing text
 * box is restored.
 */
function makeInitialNarrativeTextBox(): void {
	needNarrativeTextBox().then(
		(need) => {
			if (need) {
				const textBoxObject = {
					type: "text",
					name: kNarrativeTextBoxName,
					cannotClose: true,
					text: "This is the narrative for the beginning of your data story."
				};
				const theMessage = {
					action: "create",
					resource: "component",
					values: textBoxObject
				};

				codapInterface.sendRequest(theMessage);
			}
		}
	);
}

/**
 * Determine is we need a fresh narrative text box.
 * Returns false if one already exists
 */
async function needNarrativeTextBox(): Promise<boolean> {
	const theMessage = {action: "get", resource: "componentList"};
	const theResult: any = await codapInterface.sendRequest(theMessage);
	let need: boolean = true;

	if (theResult.success) {
		theResult.values.forEach((c: any) => {
			if (c.name === kNarrativeTextBoxName) {
				if (c.type === 'text') {
					need = false;
				}
			}
		})
	}

	return need;
}

window.onload = makeInitialNarrativeTextBox;

class StoryArea extends Component<{callbackToAssignRestoreStateFunc:any}, { numNotifications: number, stateID: number, storyMode: string }> {
	private timeline: Timeline = new Timeline(this);
	private restoreInProgress = false;
	private waitingForDocumentState = false;
	private makingMarker = false;

	constructor(props:any) {
		super(props);
		this.state = {numNotifications: 0, stateID: -1, storyMode: 'scrubber'};


		this.handleNotification = this.handleNotification.bind(this);
		this.changeStoryMode = this.changeStoryMode.bind(this);
		this.handleDeleteCurrentMoment = this.handleDeleteCurrentMoment.bind(this);
		this.startMakingMarker = this.startMakingMarker.bind(this);
		this.getPluginState = this.getPluginState.bind(this);
		this.restorePluginState = this.restorePluginState.bind(this);

		codapInterface.on('notify', '*', '', this.handleNotification);
		codapInterface.on('get', 'interactiveState', '', this.getPluginState);
		codapInterface.on('update', 'interactiveState', '', this.restorePluginState);

		/**
		 * We delay the start making marker to let the text box appear;
		 * otherwise the text box will not be in that marker's codapState.
		 */
		const this_ = this;
		setTimeout(function () {
			if( !this_.timeline.startingMoment) {
				this_.startMakingMarker();    // Make the initial marker, which sets the initial state
			}
			else {
				this_.forceUpdate();
			}
		}, kInitialMarkerStartDelay);

		console.log("Initial clear() completed. Initial mode is " + this.state.storyMode);
	}

	componentWillMount() {
		this.props.callbackToAssignRestoreStateFunc(this.restorePluginState)
	}

	getPluginState(): any {
		if( this.waitingForDocumentState) {
			return {};
		}
		else {
			return {
				success: true,
				values: this.timeline.createStorage()
			};
		}
	}

	restorePluginState( iStorage: any) {
		this.timeline.restoreFromStorage( iStorage)
	}

	/**
	 * We ask for the document state using a get-document request.
	 * But the result cannot come back, even with _await_.
	 * So we set a flag which gets unset in a partner method, `receiveNewDocumentState`.
	 */
	private requestDocumentState(): void {
		this.waitingForDocumentState = true;
		codapInterface.sendRequest({action: 'get', resource: 'document'});
	}

	/**
	 * We are notified of a `newDocumentState` event.
	 * The current CodapState is in the iCommand.
	 * @param iCommand
	 */
	private receiveNewDocumentState(iCommand: any): void {
		if (this.waitingForDocumentState) {
			this.waitingForDocumentState = false;
			if (this.makingMarker) {
				this.finishMakingMarker(iCommand.values.state);
			}
		}
	}

	/**
	 * In order to make a marker, we must get the current CODAP state.
	 */
	public startMakingMarker(): void {
		this.requestDocumentState();
		this.makingMarker = true;
	}

	/**
	 * A new codapState has arrived, so we can ask the timeline to make the marker. Finally.
	 * @param iCodapState
	 */
	public finishMakingMarker(iCodapState: any): void {
		const tMoment = this.timeline.makeMarkerOnDemand(iCodapState);
		StoryArea.displayNarrativeInTextBox(tMoment);

		this.makingMarker = false;
		this.forceUpdate();
	}



    /**
     * Responsible for handling the various notifications we receive
     * when the user makes an undoable action,
     * and also when CODAP respomds to our requests to move to a different codapState
     *
     * @param iCommand    the Command resulting from the user action
     */
    private async handleNotification(iCommand: any): Promise<any> {
        if (iCommand.resource !== 'undoChangeNotice') {     //  ignore all of these
            if (iCommand.values.operation === 'newDocumentState') {
                if (this.waitingForDocumentState) {
                    this.receiveNewDocumentState(iCommand);
                }
            } else {
                if (iCommand.values.operation === 'edit') {
                    console.log(`    edit notification on: ${iCommand.values.type} name ${iCommand.values.name}`);if (iCommand.values.type === "DG.TextView" &&
                        iCommand.values.name === kNarrativeTextBoxName) {

						//  we are notified of a change to the text in the "Narrative" text box

                        const theMessage = {action: "get", resource: "component[" + kNarrativeTextBoxName + "]"};
                        const theResult: any = await codapInterface.sendRequest(theMessage);
                        if (theResult.success) {
                            console.log(`    result successful`);const boxText = theResult.values.text;const boxTitle = theResult.values.title;
/*
                            const separatorIndex = boxText.indexOf(kSeparatorString);
                            let narrativeIndex = 0;
                            if (separatorIndex > 0) {
                                const theFocusMoment: Moment | null = this.timeline.currentMoment;

								if (theFocusMoment !== null) {
									narrativeIndex = separatorIndex + kSeparatorString.length;
									const newTitle = boxText.substring(0, separatorIndex);
									theFocusMoment.setTitle(newTitle.trim());
									this.forceUpdate();     //  put the new title into the timeline
								}

                            }
                            const theNewNarrative = boxText.substring(narrativeIndex);
                            console.log("Text get result is " + theNewNarrative);
                            this.timeline.setNewNarrative(theNewNarrative.trim());
                        */
                    console.log(`    narrative title: ${boxTitle} text: ${boxText}`);
                            this.timeline.setNewNarrative(boxText, boxTitle);
                        }}
                }

				//  this.timeline.handleNotification(iCommand);
			}
		}
	}


	private restoreCodapStateFromMoment(iMoment: Moment | null) {
		const newState = (iMoment) ? iMoment.codapState : null;
		this.restoreCodapState(newState);
	}

	/**
	 * Asks CODAP to restore itself to the given state.
	 * Note: sets restoreInProgress while it's running and resolving its promises
	 *
	 * @param iCodapState    the state to restore to; this is the potentially large JSON object
	 */
	private restoreCodapState(iCodapState: object | null): any {
		let out: any = null;
		if (iCodapState) {
			let this_ = this;
			this.restoreInProgress = true;
			out = codapInterface.sendRequest({
				action: 'update',
				resource: 'document',
				values: iCodapState
			}).then(() => {
				this_.restoreInProgress = false;
			});
		}
		return out;
	}

	/**
	 * Handles a user click on a moment in the timeline.
	 *
	 * @param e     the mouse event
	 * @param iMoment   the moment (set in the original onClick)
	 */
	public async onMomentClick(e: MouseEvent, iMoment: Moment) {
		//  if there is an actual moment, do the time-travel using `restoreCodapState`.
		if (iMoment) {
			this.timeline.handleMomentClick(iMoment);
			await this.restoreCodapStateFromMoment(iMoment);
			this.forceUpdate();
			StoryArea.displayNarrativeInTextBox(this.timeline.currentMoment);
		}
	}

	/**
	 * Called directly from the DOM
	 */
	private handleDeleteCurrentMoment(): void {
		this.timeline.removeCurrentMoment();    //  also sets a new currentMoment
		this.restoreCodapStateFromMoment(this.timeline.currentMoment);
		this.forceUpdate();     //  remove the marker from the bar, point at the current one
		StoryArea.displayNarrativeInTextBox(this.timeline.currentMoment);
	}

	private handleDrop(e: React.DragEvent) {
		let currentX = 0;

		e.stopPropagation();
		e.preventDefault();
		this.timeline.handleDrop(e.clientX);
		console.log("drop at x = " + currentX);
		this.restoreCodapStateFromMoment(this.timeline.currentMoment);
		StoryArea.displayNarrativeInTextBox(this.timeline.currentMoment);

	}

	private static handleDragOver(e: React.DragEvent) {
		e.stopPropagation();
		e.preventDefault();
		const theControlArea = document.getElementById("controlArea");
		if (theControlArea) {
			//  const currentX = e.clientX - theControlArea.offsetWidth;
		}
	}

    /**
     * Given a Moment, display its narrative in the narrative text box
     * @param iMoment
     */
    private static displayNarrativeInTextBox(iMoment: Moment | null): void {
        let titleString, narrativeString;
        if (iMoment) {
            titleString = iMoment.title;
            narrativeString = iMoment.narrative;
        } else {
            titleString = "No moments!";
            narrativeString = "Press the shutter to save a Moment in the Story Builder.";
        }
        const textBoxObject = {
            type: "text",
            name: kNarrativeTextBoxName,
            title: titleString ,
            text: narrativeString,
        };console.log(`    displayNarrative with ${JSON.stringify(textBoxObject)}`);

		const theMessage = {
			action: "update",
			resource: "component[" + kNarrativeTextBoxName + "]",
			values: textBoxObject
		};

		const Result = codapInterface.sendRequest(theMessage);
	}

	/**
	 * Toggle story mode between `scrubber` and `focus`.
	 * Change the shape of the Iframe, then change the (React) state;
	 * then, on render(), actually display different material (e.g., detailed info on a moment when `state.storyMode` is `scrubber`.)
	 */
	private changeStoryMode(): void {

		const newMode = (this.state.storyMode === 'focus') ? 'scrubber' : 'focus';

        const theMessage = {
            action: "update",
            resource: "interactiveFrame",
            values: {
                dimensions: (newMode === 'focus') ? kInitialTallDimensions : kInitialWideDimensions
            }
        };
        codapInterface.sendRequest(theMessage);     //  change the shape of the plugin
        this.setState({storyMode: newMode});
    }


	public render() {
		let this_ = this;

		/*
		Begin with a div that can contain various controls;
		it's not part of the list of moments or the editing controls for a particular moment.
		*/

		const focusButtonGuts = (this.state.storyMode === "scrubber") ? kMagnifyingGlass : "back to timeline";
		const scrubberControlArea = (
			<div id="controlArea" className="control-area">
				{/*   delete button */}
				<div id="deleteButton"
						 className="story-child tool icon-button"
						 onClick={this.handleDeleteCurrentMoment}
						 title={"press to delete the current moment"}
				>
					{kTrashCan}
				</div>

				{/*   Focus button */}
				{/*
                <div className="story-child tool icon-button"
                     onClick={this.changeStoryMode}
                     title={"press to focus on the current moment"}
                >
                    {focusButtonGuts}
                </div>
*/}

                <div className="story-child tool icon-button"
                     onClick={this.startMakingMarker}
                     title={"mark the current state"}
                >
                    <img width={"28"} src={shutterImage}></img>
                    {/*{kCheckmark}*/}
                </div>
            </div>
        );

		const focusControlArea = (
			<div id="controlArea" className="control-area">
				{/*  start with the Focus button */}
				<div className="story-child tool"
						 onClick={this.changeStoryMode}
						 title={"press to focus on the current moment"}
				>
					{focusButtonGuts}
				</div>

			</div>
		);

		/*
		Loop over all [story] moments; make a Moment for each.
		this.timeline.timeline is now a linked list, so we traverse the list
		to create theMoments, an Array of Moments on the _relevant_ timeline,
		that is, all timeline that are in the current timeline, past and future :)
		*/

		const momentsOnThisTimeline = this.timeline.momentsOnThisTimeline();

		/*
				Then we loop through that new Array to make the Moment widgets
		*/
		const theMoments = momentsOnThisTimeline.map(
			(aMoment) => {
				return (
					<MomentView
						key={aMoment.ID}
						id={aMoment.ID}
						onDragStart={
							(e: React.DragEvent) =>
								this_.timeline.handleDragStart(e, aMoment)
						}
						onClick={(e: MouseEvent) => this_.onMomentClick(e, aMoment)}
						isCurrent={aMoment === this_.timeline.currentMoment}
						theText={aMoment.title}
						isMarker={aMoment.isMarker}
					/>
				)
			}
		);

		const momentsArea = (
			<div className="story-area container-drag"
					 onDragOver={(e: React.DragEvent) => StoryArea.handleDragOver(e)}
					 onDrop={(e: React.DragEvent) => {
						 console.log("Dropping at " + e.clientX);
						 this.handleDrop(e);
						 this.forceUpdate();
					 }}
			>
				{theMoments}
			</div>
		);

		/*
		If we are editing (focusing on) a particular moment, we look in detail at that moment,
		which we call theFocusMoment.
		 */
		const theFocusMoment: Moment | null = this.timeline.currentMoment;       //  focusMoment();

		const focusArea = (theFocusMoment !== null) ?
			(
				<div className="focus-area">
					<p>
						{/*
                        <label for={"focusMomentTitleText"}>Moment {theFocusMoment.ID}</label>
*/}
						<input
							id="focusMomentTitleText"
							type={"text"}
							value={theFocusMoment.title}
							onChange={(e) => {
								const theText: string = e.target.value;
								theFocusMoment.setTitle(theText);
								StoryArea.displayNarrativeInTextBox(theFocusMoment);
								this.forceUpdate();
							}}
						/>
						({theFocusMoment.created.toLocaleTimeString()})
					</p>

					narrative:<br/>
					<textarea
						rows={5}
						value={theFocusMoment.narrative}
						onChange={(e) => {
							const theText: string = e.target.value;
							theFocusMoment.setNarrative(theText);
							StoryArea.displayNarrativeInTextBox(theFocusMoment);
							this.forceUpdate();
						}}
					/>
					<br/>
					<label htmlFor="checkboxSetMarker">Marker?</label>
					<input
						type="checkbox"
						id="checkboxSetMarker"
						checked={theFocusMoment.isMarker}
						onChange={() => {
							theFocusMoment.setMarker(!theFocusMoment.isMarker);
							this.forceUpdate();
						}}
					/>

				</div>
			) : (
				<div className="focus-area">
					<p>There is no moment to report on; the focus moment was not found in the list!</p>
				</div>
			);

		const theContent = (this.state.storyMode === "scrubber") ? momentsArea : focusArea;
		const theStoryPanelStyle = (this.state.storyMode === "scrubber") ? "story-panel-wide" : "story-panel-tall";
		const controlArea = (this.state.storyMode === "scrubber") ? scrubberControlArea : focusControlArea;
		return (
			<div className={theStoryPanelStyle}>
				{controlArea}
				{theContent}
			</div>

		);
	}
}


/**
 * Top-level "App" component.
 * Represents the whole iFrame; contains the <StoryArea>
 */
class DataStories
	extends Component<{}, { shape: string }> {
	private storyRestoreStateFunc:any;

	constructor(props: any) {
		super(props);
		this.assignStoryRestoreStateFunc = this.assignStoryRestoreStateFunc.bind(this);
		this.restorePluginState = this.restorePluginState.bind(this);
		this.state = {shape: "wide"};
	}

	assignStoryRestoreStateFunc( iFunc: any) {
		this.storyRestoreStateFunc = iFunc;
	}

	restorePluginState( iState: any) {
		if( this.storyRestoreStateFunc)
			this.storyRestoreStateFunc( iState);
	}

	/**
	 * LifeCycle method.
	 * Calls initializePlugin from codap-helper.
	 */
	public async componentWillMount() {
		await initializePlugin(kPluginName, kVersion, kInitialWideDimensions, this.restorePluginState);

		const getComponentListMessage = {
			'action': 'get',
			'resource': 'componentList'
		};

		//  console.log('trying to get information on the plugin as a component with ' + JSON.stringify(getComponentListMessage));
		try {
			codapInterface.sendRequest(getComponentListMessage).then(
				(tResult: any) => {
					const listResult = tResult.values;
					console.log('components: ' + JSON.stringify(listResult));
					let thePluginID = null;
					listResult.forEach((c: any) => {
						if (c.title === kPluginName) {
							thePluginID = c.id;
							console.log(kPluginName + ' has ID ' + thePluginID);
						}
					});
					const positionValues = "{left: 8, top: 222}";       //  'bottom'
					const adjustPluginMessage = {
						'action': 'update',
						'resource': 'component[' + thePluginID + ']',
						'values': {'position': positionValues, 'cannotClose': true}
					};
					console.log('trying to adjust the plugin with ' + JSON.stringify(adjustPluginMessage));
					codapInterface.sendRequest(adjustPluginMessage).then(
						(res) => {
							console.log('Adjust plugin result: ' + JSON.stringify(res));
						}
					);
				}
			);
		} catch (err) {
			console.log('error trying to get id: ' + err);
		}
	}


    public render() {

        return (
            <div className="App">
                <StoryArea callbackToAssignRestoreStateFunc = {this.assignStoryRestoreStateFunc}/>
            </div>
        );
    }

}

export default DataStories;
