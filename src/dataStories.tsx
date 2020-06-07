import React, {Component} from 'react';
import codapInterface from "./lib/CodapInterface";
import {initializePlugin} from './lib/codap-helper';
import {Timeline} from './timeline';
import {MomentView, Moment} from './moment';
//  import Swal from 'sweetalert2';
import './dataStories.css';

import shutterImage from "./art/shutter.png";
import {isMainThread} from "worker_threads";

let gNarrativeBoxID: number = 0;        //  global
let gChangeCount = 0;

const kPluginName = "Story Builder";
const kInitialMomentStartDelay = 1200;      //  milliseconds
const kNarrativeTextBoxName = "WDS-narrative-box";
const kNarrativeTextBoxTitle = "start ... comienzo";

const kMagnifyingGlass = "\ud83d\udd0d";
const kCheckmark = "\u2714";
const kTrashCan = "\uD83D\uddd1";
const kSave = "save";
const kRevert = "rev";

const kVersion = "0.3";
const kInitialWideDimensions = {
    width: 800,
    height: 100
};
const kInitialTallDimensions = {
    width: 333,
    height: 555
};

function Credits(props: any) {
    return (
        <div id={"credits"}>
            <div>Some icons made by <a href="https://www.flaticon.com/authors/fjstudio"
                                       title="fjstudio">fjstudio</a> from <a href="https://www.flaticon.com/"
                                                                             title="Flaticon">www.flaticon.com</a></div>
        </div>
    )
}

function getNarrativeBoxInfoFromCodapState(iState: any): object {
    const theComponents = iState.components;
    let theComponentStorage: any = null;

    if (theComponents.length > 1) {
        theComponents.forEach((comp: any) => {
            if (comp.type === "DG.TextView" /* && comp.componentStorage.name === kNarrativeTextBoxName */) {
                theComponentStorage = comp.componentStorage;
            }
        });

        if (theComponentStorage) {
            return {
                narrative: theComponentStorage.text,
                title: theComponentStorage.title,
            }
        } else {
            alert(`problem: theComponentStorage may be null. Perhaps the text component is missing or undetectable...`);

        }
    } else {
        alert(`problem: theComponents has length ${theComponents.length}. We expect at least two!`);
    }

    return {
        narrative : "foo",
        title : "foo",
    }
}


function resetChangeCount(): void {
    console.log(`RESET: change count from ${gChangeCount} to 0`);
    gChangeCount = 0;
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

//  window.onload = makeInitialNarrativeTextBox;

class StoryArea extends Component<{ callbackToAssignRestoreStateFunc: any }, { numNotifications: number, stateID: number, storyMode: string }> {
    private timeline: Timeline = new Timeline(this);
    private restoreInProgress = false;
    private waitingForDocumentState = false;
    private saveStateInSrcMoment = false;
    private saveStateInDstMoment = false;

    constructor(props: any) {
        super(props);
        this.state = {numNotifications: 0, stateID: -1, storyMode: 'scrubber'};

        this.handleNotification = this.handleNotification.bind(this);
        this.changeStoryMode = this.changeStoryMode.bind(this);
        this.handleDeleteCurrentMoment = this.handleDeleteCurrentMoment.bind(this);
        this.handleUpdateCurrentMoment = this.handleUpdateCurrentMoment.bind(this);
        this.handleRevertCurrentMoment = this.handleRevertCurrentMoment.bind(this);
        this.handleMakeNewMomentButtonPress = this.handleMakeNewMomentButtonPress.bind(this);
        this.getPluginState = this.getPluginState.bind(this);
        this.restorePluginState = this.restorePluginState.bind(this);

        codapInterface.on('notify', '*', '', this.handleNotification);
        codapInterface.on('get', 'interactiveState', '', this.getPluginState);
        codapInterface.on('update', 'interactiveState', '', this.restorePluginState);

        /**
         * We delay the start making the initial moment to let the text box appear;
         * otherwise the text box will not be in that Moment's codapState.
         */
        if (needNarrativeTextBox()) {
            const this_ = this;
            setTimeout(function () {
                if (!this_.timeline.startingMoment) {
                    this_.makeInitialMomentAndTextComponent();
                } else {
                    this_.forceUpdate();
                }
            }, kInitialMomentStartDelay);
        }

        //  Swal.fire('Hello, Tim!');
        console.log("Initial clear() completed. Initial mode is " + this.state.storyMode);
    }

    async makeInitialMomentAndTextComponent(): Promise<void> {
        const tMoment = this.timeline.makeNewMomentUsingCodapState(null);

        //  make initial text box
        const tNeed: boolean = await needNarrativeTextBox();

        if (tNeed) {
            const theMessage = {
                action: "create",
                resource: "component",
                values: {
                    type: "text",
                    name: kNarrativeTextBoxName,
                    title: tMoment.title,
                    cannotClose: true,
                    text: tMoment.narrative,
                }
            };

            const tResult: any = await codapInterface.sendRequest(theMessage);
            if (tResult.success) {
                gNarrativeBoxID = tResult.values.id;
                console.log(`Text box id ${gNarrativeBoxID} created.`);
            }
        } else {
            console.log("Text box already existed");
        }

        //      at this point, `tMoment.codapState` is still null.

        this.timeline.currentMoment = tMoment;
        await StoryArea.displayNarrativeInTextBox(this.timeline.currentMoment);

        this.forceUpdate();     //  make the moment appear on the screen in the bar
    }

    componentWillMount() {
        this.props.callbackToAssignRestoreStateFunc(this.restorePluginState)
    }

    getPluginState(): any {
        if (this.waitingForDocumentState) {
            return {};
        } else {
            return {
                success: true,
                values: this.timeline.createStorage()
            };
        }
    }

    restorePluginState(iStorage: any) {
        this.timeline.restoreFromStorage(iStorage)
    }

    doBeginChangeToNewMoment(iMoment: Moment | null) {

        if (this.timeline.currentMoment) {
            this.timeline.srcMoment = this.timeline.currentMoment;

            if (iMoment) {  //  a destination moment already exists
                this.timeline.dstMoment = iMoment;
            } else {        //  we are making a new moment
                this.timeline.dstMoment = this.timeline.makeNewMomentUsingCodapState(null);
                //  it is not yet the current moment
            }

            //  we are now guaranteed that srcMoemnt and dstMoment are Moments, not null.

            const qSaveChanges =
                `You have ${gChangeCount} change${gChangeCount === 1 ? "" : "s"}. ` +
                `Would you like to save ${gChangeCount === 1 ? "it" : "them"} in ${this.timeline.getCurrentMomentTitle()}?`;
            const qChangesStayOnScreen = `Stay on screen?`;

            this.saveStateInSrcMoment = false;
            this.saveStateInDstMoment = false;

            if (!this.timeline.srcMoment.codapState) {
                //  whenever you're going from a "new" moment, you must save its state.
                //  this is a convenience; we could ask.
                this.saveStateInSrcMoment = true;
            } else if (gChangeCount === 0) {
                //  no changes? We'll effectively save, but we won't ask.
                this.saveStateInSrcMoment = true;       //  could be false..shouldn't matter, right?
            } else if (window.confirm(qSaveChanges)) {
                //  there have been changes, so we will save.
                this.saveStateInSrcMoment = true;
            } else if (!this.timeline.dstMoment.codapState
                && window.confirm(qChangesStayOnScreen)) {
                //  so we're NOT saving changes in the source, but do we want them in the destination
                this.saveStateInDstMoment = true;
            } else {
                //  we don't want to save the srcMoment. Nor in the dst.
            }

            this.requestDocumentState();

        } else {
            alert("Hmmm. timeline.currentMoment is not set.");
        }

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
            if (this.saveStateInSrcMoment) {
                this.matchMomentToCODAPState(this.timeline.srcMoment, iCommand.values.state);
            }
            if (this.saveStateInDstMoment) {
                this.matchMomentToCODAPState(this.timeline.dstMoment, iCommand.values.state);
            }
            this.doEndChangeToNewMoment();
        }
    }

    private async doEndChangeToNewMoment(): Promise<void> {

        this.timeline.currentMoment = this.timeline.dstMoment;

        await this.matchCODAPStateToMoment(this.timeline.currentMoment);
        await StoryArea.displayNarrativeInTextBox(this.timeline.currentMoment);

        this.forceUpdate();
        console.log(this.timeline.getMomentSummary());
    }


    /**
     * invoked when the user presses the "shutter" button.
     * We will by default store the current CODAP state
     * in the codapState of the marker.
     *
     * So we need the state from CODAP itself.
     * We actually receive the state in handleNotification(). This just makes the request.
     */
    public handleMakeNewMomentButtonPress(): void {
        this.doBeginChangeToNewMoment(null);
    }


    /**
     * Utility to update the given moment with the given state.
     *
     * @param iMoment
     * @param iState
     */
    private async matchMomentToCODAPState(iMoment: Moment | null, iState: object): Promise<void> {
        const tTextBoxInfo: any = getNarrativeBoxInfoFromCodapState(iState);
        if (iMoment instanceof Moment) {
            console.log(`Setting [${iMoment.title}] to match a state (text comp title is ${tTextBoxInfo.title})... 
            \n    before update: ${iMoment.toString()}`)
            iMoment.setCodapState(iState);
            iMoment.created = new Date();

            iMoment.setTitle(tTextBoxInfo.title);
            iMoment.setNarrative(tTextBoxInfo.narrative);


            console.log(`    after update: ${iMoment.toString()}`)
        } else {
            console.log(`Hmmm. Tried to update a non-Moment in updateMoment(): ${JSON.stringify(iMoment)}`)
        }
    }

    /**
     * Responsible for handling the various notifications we receive
     * when the user makes an undoable action,
     * and also when CODAP respomds to our requests to move to a different codapState
     *
     * @param iCommand    the Command resulting from the user action
     */
    private async handleNotification(iCommand: any): Promise<any> {
        if (iCommand.resource === 'undoChangeNotice') {     //  ignore all of these
            gChangeCount++;
            console.log(`change count: ${gChangeCount}`);
        } else {
            console.log(`  notification! ${iCommand.resource} op ${iCommand.values.operation}`);
            if (iCommand.values.operation === 'newDocumentState') {
                if (this.waitingForDocumentState) {
                    this.receiveNewDocumentState(iCommand);
                }
            } else if (iCommand.values.operation === 'titleChange') {
                const textBoxComponentResourceString = `component[${gNarrativeBoxID}]`;
                if (iCommand.resource === textBoxComponentResourceString) {
                    console.log(`TITLE changed to "${iCommand.values.to}"`);
                    this.timeline.setNewTitle(iCommand.values.to);
                    this.forceUpdate();
                }
            } else if (iCommand.values.operation === 'edit') {
                console.log(`    edit notification! edit ${JSON.stringify(iCommand.values)}`);
            }
        }
    }


    private async matchCODAPStateToMoment(iMoment: Moment | null) {
        const newState = (iMoment) ? iMoment.codapState : null;
        this.restoreCodapState(newState);
    }

    /**
     * Asks CODAP to restore itself to the given state.
     * Note: sets restoreInProgress while it's running and resolving its promises
     * todo: should this be async?
     * @param iCodapState    the state to restore to; this is the potentially large JSON object
     */
    private async restoreCodapState(iCodapState: object | null): Promise<any> {
        let out: any = null;
        if (iCodapState) {
            let this_ = this;
            this.restoreInProgress = true;
            out = await codapInterface.sendRequest({
                action: 'update',
                resource: 'document',
                values: iCodapState
            })

            this_.restoreInProgress = false;
            resetChangeCount();
        }

        return out;
    }

    /**
     * Handles a user click on a moment in the timeline.
     *
     * @param   e     the mouse event
     * @param iMoment   the moment (set in the original onClick)
     */
    public async handleMomentClick(e: MouseEvent, iMoment: Moment) {
        if (iMoment) {
            console.log(`Click on [${iMoment.title}]`);
            this.doBeginChangeToNewMoment(iMoment);
        }
    }

    /**
     * Called directly from the DOM
     * User clicks on the trash can
     */
    private handleDeleteCurrentMoment(): void {
        this.timeline.removeCurrentMoment();    //  also sets a new currentMoment
        this.matchCODAPStateToMoment(this.timeline.currentMoment);
        this.forceUpdate();     //  remove the marker from the bar, point at the current one
        //  StoryArea.displayNarrativeInTextBox(this.timeline.currentMoment);
    }

    /**
     * user clicks revert.
     * Make CODAP revert to the last-saved state associated with the currentMoment.
     */
    private handleRevertCurrentMoment(): void {
        this.matchCODAPStateToMoment(this.timeline.currentMoment);

        //  this.forceUpdate();     //  in case there's any change
    }

    /**
     * user clicks save (i.e., update the current moment so that
     * its codapState matches the document)
     */
    private handleUpdateCurrentMoment(): void {
        if (this.timeline.currentMoment) {
            this.saveStateInSrcMoment = true;
            this.saveStateInDstMoment = true;
            this.timeline.srcMoment = this.timeline.currentMoment;
            this.timeline.dstMoment = this.timeline.currentMoment;

            this.requestDocumentState();
        }
    }

    private handleDrop(e: React.DragEvent) {
        let currentX = 0;

        e.stopPropagation();
        e.preventDefault();
        this.timeline.handleDrop(e.clientX);
        console.log("drop at x = " + currentX);
        this.matchCODAPStateToMoment(this.timeline.currentMoment);
        //  StoryArea.displayNarrativeInTextBox(this.timeline.currentMoment);
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
    private static async displayNarrativeInTextBox(iMoment: Moment | null): Promise<void> {
        let momentTitleString, narrativeString;
        if (iMoment) {
            momentTitleString = iMoment.title;
            narrativeString = iMoment.narrative;
        } else {
            momentTitleString = "No moments!";
            narrativeString = "Press the shutter to save a Moment in the Story Builder.";
        }
        const textBoxObject = {
            type: "text",
            name: kNarrativeTextBoxName,
            title: momentTitleString,
            text: narrativeString,
        };

        const theMessage = {
            action: "update",
            resource: "component[" + kNarrativeTextBoxName + "]",
            values: textBoxObject
        };

        // console.log(`...displayNarrativeInTextBox() in moment [${momentTitleString}]: ${narrativeString}`);

        const tResult: any = await codapInterface.sendRequest(theMessage);
        if (tResult.success) {
            //  console.log(`...successfully updated the text box`);
        }
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

        const modelDialog = (
            <div className="userChoiceDialog">
                This is our dialog
            </div>
        );

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

                {/*   revert button */}
{/*
                <div id="updateButton"
                     className="story-child tool icon-button"
                     onClick={this.handleRevertCurrentMoment}
                     title={"press to update the current moment"}
                >
                    {kRevert}
                </div>
*/}

                {/*   update button */}
{/*
                <div id="updateButton"
                     className="story-child tool icon-button"
                     onClick={this.handleUpdateCurrentMoment}
                     title={"press to update the current moment"}
                >
                    {kSave}
                </div>
*/}

                {/*		this is the shutter button, for making a new marker		*/}
                <div className="story-child tool icon-button"
                     onClick={this.handleMakeNewMomentButtonPress}
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
                        onClick={(e: MouseEvent) => this_.handleMomentClick(e, aMoment)}
                        isCurrent={aMoment === this_.timeline.currentMoment}
                        theText={aMoment.title}
                        hasNoCodapState={(aMoment.codapState === null)}
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
    private storyRestoreStateFunc: any;

    constructor(props: any) {
        super(props);
        this.assignStoryRestoreStateFunc = this.assignStoryRestoreStateFunc.bind(this);
        this.restorePluginState = this.restorePluginState.bind(this);
        this.state = {shape: "wide"};
    }

    assignStoryRestoreStateFunc(iFunc: any) {
        this.storyRestoreStateFunc = iFunc;
    }

    restorePluginState(iState: any) {
        if (this.storyRestoreStateFunc)
            this.storyRestoreStateFunc(iState);
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
                    //  console.log('components: ' + JSON.stringify(listResult));
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
                    //  console.log('trying to adjust the plugin with ' + JSON.stringify(adjustPluginMessage));
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
                <StoryArea callbackToAssignRestoreStateFunc={this.assignStoryRestoreStateFunc}/>
            </div>
        );
    }

}

export default DataStories;
