import React, {Component} from 'react';
import codapInterface from "./lib/CodapInterface";
import {initializePlugin} from './lib/codap-helper';
import {Timeline} from './timeline';
import {MomentModel, Moment} from './moment';
//  import Swal from 'sweetalert2';
import './dataStories.css';

import infoImage from "./art/info.png";
import shutterImage from "./art/shutter.png";
import {isMainThread} from "worker_threads";

let gNarrativeBoxID: number = 0;        //  global
let gChangeCount = 0;

const kPluginName = "Story Builder";
//  const kInitialMomentStartDelay = 1200;      //  milliseconds
const kNarrativeTextBoxName = "WDS-narrative-box";
//  const kNarrativeTextBoxTitle = "start ... comienzo";

const kMagnifyingGlass = "\ud83d\udd0d";
const kCheckmark = "\u2714";
const kTrashCan = "🗑";   //    "\uD83D\uddd1";       //  🗑️
const kSave = "save";
const kRevert = "rev";

const kVersion = "0.52";
const kInitialWideDimensions = {
    width: 800,
    height: 100
};
const kInitialTallDimensions = {
    width: 333,
    height: 555
};


function putTextComponentInfoIntoCodapState(info: any, iState: any): void {
    const theComponents = iState.components;
    let theComponentStorage: any = null;

    if (theComponents.length) {     //  works even if there is only one component; why not, after all?
        theComponents.forEach((comp: any) => {
            if (comp.type === "DG.TextView" && comp.componentStorage.name === kNarrativeTextBoxName) {
                theComponentStorage = comp.componentStorage;
                if (theComponentStorage) {
                    theComponentStorage.text = info.narrative;
                    theComponentStorage.title = info.title;
                }
            }
        });

    } else {
        alert(`problem: theComponents has length ${theComponents.length}. We expect at least one!`);
    }

}

function getNarrativeBoxInfoFromCodapState(iState: any): object {
    const theComponents = iState.components;
    let theComponentStorage: any = null;

    if (theComponents.length > 1) {
        theComponents.forEach((comp: any) => {
            if (comp.type === "DG.TextView" && comp.componentStorage.name === kNarrativeTextBoxName) {
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
        narrative: "foo",
        title: "foo",
    }
}


function resetChangeCount(): void {
    console.log(`RESET: change count from ${gChangeCount} to 0`);
    gChangeCount = 0;
}

/**
 * Determine if we need a fresh narrative text box.
 * Returns the ID of the text box, 0 if not found.
 */
async function needNarrativeTextBox(): Promise<number> {
    let need: number = 0;

    const theMessage = {action: "get", resource: "componentList"};
    const theResult: any = await codapInterface.sendRequest(theMessage)
        .catch(()=>{
            console.log(`••• problem finding out about the component list`);
            return need;
        });


    if (theResult.success) {
        theResult.values.forEach((c: any) => {
            if (c.name === kNarrativeTextBoxName) {
                if (c.type === 'text') {
                    need = c.id as number;
                }
            }
        })
    }

    return need;
}


class StoryArea extends Component<{ callbackToAssignRestoreStateFunc: any }, { numNotifications: number, stateID: number }> {
    private timeline: Timeline = new Timeline(this);
    private restoreInProgress = false;
    private waitingForDocumentState = false;
    private saveStateInSrcMoment = false;
    private saveStateInDstMoment = false;
    private editingMomentTitle = false;       //  are we editing the title of the currentMoment in place?

    constructor(props: any) {
        super(props);
        this.state = {numNotifications: 0, stateID: -1};

        this.handleNotification = this.handleNotification.bind(this);
        //  this.changeStoryMode = this.changeStoryMode.bind(this);
        this.handleDeleteCurrentMoment = this.handleDeleteCurrentMoment.bind(this);
        this.handleUpdateCurrentMoment = this.handleUpdateCurrentMoment.bind(this);
        this.handleRevertCurrentMoment = this.handleRevertCurrentMoment.bind(this);
        this.handleMakeNewMomentButtonPress = this.handleMakeNewMomentButtonPress.bind(this);
        this.handleSaveCurrentMomentButtonPress = this.handleSaveCurrentMomentButtonPress.bind(this);
        this.handleTitleEditBlur = this.handleTitleEditBlur.bind(this);
        this.handleGetHelp = this.handleGetHelp.bind(this);
        this.getPluginState = this.getPluginState.bind(this);
        this.restorePluginState = this.restorePluginState.bind(this);

        codapInterface.on('notify', '*', '', this.handleNotification);
        codapInterface.on('get', 'interactiveState', '', this.getPluginState);
        codapInterface.on('update', 'interactiveState', '', this.restorePluginState);

        /**
         * We delay the start making the initial moment to let the text box appear;
         * otherwise the text box will not be in that Moment's codapState.
         */

        needNarrativeTextBox().then((theID) => {
                if (theID) {   //  there is a text box with a nonzero ID
                    console.log(`StoryArea constructor: initial text box found with ID ${theID}`);
                    gNarrativeBoxID = theID;

                } else {
                    if (!this.timeline.startingMoment) {
                        this.makeInitialMomentAndTextComponent();
                    } else {
                        this.forceUpdate();
                    }

                    /*
                                    const this_ = this;
                                    setTimeout(function () {
                                        if (!this_.timeline.startingMoment) {
                                            this_.makeInitialMomentAndTextComponent();
                                        } else {
                                            this_.forceUpdate();
                                        }
                                    }, kInitialMomentStartDelay);
                    */
                }
            }
        )

        //  Swal.fire('Hello, Tim!');
        //  console.log("Initial clear() completed. Initial mode is " + this.state.storyMode);
    }

    /**
     * Called from the constructor if there is no existing narrative text box
     */
    async makeInitialMomentAndTextComponent(): Promise<void> {
        const tMoment = this.timeline.makeNewMomentUsingCodapState(null);   //  the unsaved moment has no state yet

        //  make initial text box
        const tNarrativeID: number = await needNarrativeTextBox()
            .catch(()=>{
                console.log(`••• problem finding out about the narrative text box`);
                return 0;
            });

        if (tNarrativeID) {
            gNarrativeBoxID = tNarrativeID;
            console.log(`StoryArea.makeInitialMomentAndTextComponent: Text box id ${gNarrativeBoxID} found.`);

        } else {
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

            const tResult: any = await codapInterface.sendRequest(theMessage)
                .catch(()=>{console.log(`••• problem creating the narrative text box`)});
            if (tResult.success) {
                gNarrativeBoxID = tResult.values.id;
                console.log(`StoryArea.makeInitialMomentAndTextComponent: Text box id ${gNarrativeBoxID} created.`);
            }
        }

        //      at this point, `tMoment.codapState` is still null.

        this.timeline.currentMoment = tMoment;
        await StoryArea.displayNarrativeInTextBox(this.timeline.currentMoment)
            .catch(()=>{console.log(`••• problem displaying the narrative in the text box`)});

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
        this.timeline.restoreFromStorage(iStorage);
        this.forceUpdate();
    }

    handleSaveCurrentMomentButtonPress(e : MouseEvent) {
        this.editingMomentTitle = false;        //      just in case
        e.stopPropagation();

        if (this.timeline.currentMoment) {
            this.timeline.srcMoment = this.timeline.dstMoment = this.timeline.currentMoment;
            this.saveStateInSrcMoment = true;
            this.requestDocumentState();
            console.log(`Explicitly saved [${this.timeline.currentMoment.title}] in saveCurrentMoment`);
        } else {
            alert(`Hmmm. There is no current moment to save`);
        }
    }

    doBeginChangeToNewMoment(iMoment: MomentModel | null) {

        if (this.timeline.currentMoment) {
            this.timeline.srcMoment = this.timeline.currentMoment;

            if (iMoment) {  //  a destination moment already exists
                this.editingMomentTitle = false;    //  we do not want to automatically edit one we're moving to
                this.timeline.dstMoment = iMoment;
            } else {        //  we are making a new moment
                this.editingMomentTitle = true;    //  we do want to automatically edit the new one
                this.timeline.dstMoment = this.timeline.makeNewMomentUsingCodapState(null);
                //  it is not yet the current moment
            }

            //  we are now guaranteed that srcMoemnt and dstMoment are Moments, not null.

            const qSaveChanges =
                `You have made ${gChangeCount === 1 ? "a change" : "some changes"}. ` +
                `Would you like to save ${gChangeCount === 1 ? "it" : "them"} in [${this.timeline.getCurrentMomentTitle()}]?`;
            const qChangesStayOnScreen = `The new moment you're making will be called [${this.timeline.dstMoment.title}]. ` +
                `Would you like these changes to appear in [${this.timeline.dstMoment.title}]?`;

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
        console.log(`Requesting a document state, currentMoment is [${this.timeline.getCurrentMomentTitle()}]`)
    }

    /**
     * We are notified of a `newDocumentState` event.
     * The current CodapState is in the iCommand.
     * @param iCommand
     */
    private receiveNewDocumentState(iCommand: any): void {
        if (this.waitingForDocumentState) {
            this.waitingForDocumentState = false;
            console.log(`received a document state we were waiting for`);

            if (this.saveStateInSrcMoment) {
                this.matchMomentToCODAPState(this.timeline.srcMoment, iCommand.values.state, false);
            }
            if (this.saveStateInDstMoment) {
                this.matchMomentToCODAPState(this.timeline.dstMoment, iCommand.values.state, true);
            }
            this.doEndChangeToNewMoment();
        } else {
            console.log(`received a document state --- but we were not waiting for one`);

        }
    }

    private async doEndChangeToNewMoment(): Promise<void> {

        this.timeline.currentMoment = this.timeline.dstMoment;

        await this.matchCODAPStateToMoment(this.timeline.currentMoment)
            .catch(()=>{console.log(`••• problem matching the codap state 
            to [${this.timeline.getCurrentMomentTitle()}]`)});
        await StoryArea.displayNarrativeInTextBox(this.timeline.currentMoment)
            .catch(()=>{console.log(`••• problem diaplaying the narrative 
            for [${this.timeline.getCurrentMomentTitle()}] in the text box`)});;

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
    public handleMakeNewMomentButtonPress(e : MouseEvent) {
        e.stopPropagation();
        console.log(`handleMakeNewMomentButtonPress`);
        this.doBeginChangeToNewMoment(null);
    }


    /**
     * Utility to update the given moment with the given state.
     *
     * @param iMoment
     * @param iState
     */
    private async matchMomentToCODAPState(iMoment: MomentModel | null, iState: object, preserveMomentInfo: boolean): Promise<void> {
        const tTextBoxInfo: any = getNarrativeBoxInfoFromCodapState(iState);
        if (iMoment instanceof MomentModel) {
            console.log(`Setting [${iMoment.title}] to match a state (text comp title is [${tTextBoxInfo.title}])...`);
            //          \n    before update: ${iMoment.toString()}`)
            iMoment.setCodapState(iState);
            iMoment.modified = new Date();

            if (preserveMomentInfo) {
                putTextComponentInfoIntoCodapState({
                    title: iMoment.title,
                    narrative: iMoment.narrative
                }, iMoment.codapState);
            } else {
                iMoment.setTitle(tTextBoxInfo.title);
                iMoment.setNarrative(tTextBoxInfo.narrative);
            }
            //  after-update console log used to be here
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
            //  console.log(`  notification! Resource: ${iCommand.resource}, operation: ${iCommand.values.operation}`);
            if (iCommand.values.operation === 'newDocumentState') {
                this.receiveNewDocumentState(iCommand);
            } else if (iCommand.values.operation === 'titleChange') {
                const textBoxComponentResourceString = `component[${gNarrativeBoxID}]`;
                if (iCommand.resource === textBoxComponentResourceString) {
                    console.log(`TITLE changed to "${iCommand.values.to}... change count is ${gChangeCount}"`);
                    this.timeline.setNewTitle(iCommand.values.to);
                    this.forceUpdate();
                }
            } else if (iCommand.values.operation === 'edit') {
                console.log(`    edit notification! edit ${JSON.stringify(iCommand.values)}`);
            }
        }
    }

    private async matchCODAPStateToMoment(iMoment: MomentModel | null) {
        const newState = (iMoment) ? iMoment.codapState : null;
        const tMomentID = (iMoment) ? iMoment.ID : "null";  //  for catch error reporting

        await this.restoreCodapState(newState)
            .catch(() => console.log(`••• caught matching CODAP state to moment [${tMomentID}]`));
    }

    /**
     * Asks CODAP to restore itself to the given state.
     * Note: sets restoreInProgress while it's running and resolving its promises
     * @param iCodapState    the state to restore to; this is the potentially large JSON object
     */
    private async restoreCodapState(iCodapState: object | null): Promise<any> {
        let out: any = null;
        console.log(`begin restore state`);
        if (iCodapState) {
            let this_ = this;
            this.restoreInProgress = true;
            out = await codapInterface.sendRequest({
                action: 'update',
                resource: 'document',
                values: iCodapState
            }).catch( ()=> {console.log(`•••  caught restoring CODAP state`)})

            console.log('end restore state');
            this_.restoreInProgress = false;
            resetChangeCount();
        } else {
            console.log(`no state to restore`);
        }

        return out;
    }

    public handleGetHelp() {
        alert("You get help!");
    }

    /**
     * Handles a user click on a moment in the timeline.
     *
     * @param   e     the mouse event
     * @param iMoment   the moment (set in the original onClick)
     */
    public async handleMomentClick(e: MouseEvent, iMoment: MomentModel) {
        if (iMoment) {
            console.log(`Click on [${iMoment.title}] in handleMomentClick`);
            this.doBeginChangeToNewMoment(iMoment);

            if (iMoment === this.timeline.currentMoment) {
                this.editingMomentTitle = true;
                console.log("CLICK on Current Moment");
            } else {
                this.editingMomentTitle = false;    //  stop editing when you leave the current moment
            }
        }
    }

    /**
     * User clicks on the trash can
     */
    private handleDeleteCurrentMoment(): void {
        console.log(`begin deleting current moment`);
        this.editingMomentTitle = false;        //  just in case
        this.timeline.removeCurrentMoment();    //  also sets a new currentMoment
        console.log(`moment removed from timeline; ready to match to new current moment`);
        this.matchCODAPStateToMoment(this.timeline.currentMoment);
        this.forceUpdate();     //  remove the marker from the bar, point at the current one
        //  StoryArea.displayNarrativeInTextBox(this.timeline.currentMoment);
    }

    /**
     * user clicks revert.
     * Make CODAP revert to the last-saved state associated with the currentMoment.
     */
    private handleRevertCurrentMoment(): void {
        this.editingMomentTitle = false;        //          just in case!
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

    private handleTitleEditBlur( iNewTitle: string ) {
        this.editingMomentTitle = false;
        console.log(`BLUR: new title is ${iNewTitle}`);
        this.timeline.setNewTitle(iNewTitle);
        StoryArea.displayNarrativeInTextBox(this.timeline.currentMoment);
        this.forceUpdate();
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
    private static async displayNarrativeInTextBox(iMoment: MomentModel | null): Promise<void> {
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

        const tResult: any = await codapInterface.sendRequest(theMessage)
            .catch(()=>{console.log(`••• problem updating the narrative text box`)});
        if (tResult.success) {
            //  console.log(`...successfully updated the text box`);
        }
    }

    /**
     * Toggle story mode between `scrubber` and `focus`.
     * Change the shape of the Iframe, then change the (React) state;
     * then, on render(), actually display different material (e.g., detailed info on a moment when `state.storyMode` is `scrubber`.)
     */
/*
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

*/

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

        //  const focusButtonGuts = (this.state.storyMode === "scrubber") ? kMagnifyingGlass : "back to timeline";
        const scrubberControlArea = (
            <div id="controlArea" className="control-area">
                <InfoButton onClick={(e: MouseEvent) => this_.handleGetHelp()} />
                <DeleteButton onClick={(e: MouseEvent) => this_.handleDeleteCurrentMoment()} />
                <NewMomentButton onClick={(e: MouseEvent) => this_.handleMakeNewMomentButtonPress(e)} />

                    {/*   info button */}
{/*
                <div id="infoButton"
                     className="story-child tool icon-button"
                     onClick={e => this_.handleGetHelp()}
                     title={"press to get some instructions"}
                >
                    <img width={"28"} src={infoImage}></img>
                </div>
*/}

                {/*   delete button */}
{/*
                <div id="deleteButton"
                     className="story-child tool icon-button"
                     onClick={e => this_.handleDeleteCurrentMoment()}
                     title={"press to delete the current moment"}
                >
                    {kTrashCan}
                </div>
*/}

                {/*		this is the shutter button, for making a new marker		*/}
{/*
                <div className="story-child tool icon-button"
                     onClick={(e: MouseEvent) => this_.handleMakeNewMomentButtonPress(e)}
                     title={"capture this moment"}
                >
                    <img width={"28"} src={shutterImage} alt={"snap!"}/>
                </div>
*/}
            </div>
        );

        /*
                const focusControlArea = (
                    <div id="controlArea" className="control-area">
                        {/!*  start with the Focus button *!/}
                        <div className="story-child tool"
                             onClick={this.changeStoryMode}
                             title={"press to focus on the current moment"}
                        >
                            {focusButtonGuts}
                        </div>

                    </div>
                );
        */

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

        let tMomentNumber = 0;

        const theMoments = momentsOnThisTimeline.map(
            (aMoment) => {
                tMomentNumber++;
                return (
                    <Moment
                        key={aMoment.ID}
                        id={aMoment.ID}
                        onDragStart={
                            (e: React.DragEvent) =>
                                this_.timeline.handleDragStart(e, aMoment)
                        }
                        onClick={(e: MouseEvent) => this_.handleMomentClick(e, aMoment)}
                        onDelete={(e: MouseEvent) => this_.handleDeleteCurrentMoment()}
                        onRevert={(e: MouseEvent) => this_.handleRevertCurrentMoment()}
                        onNewMoment={(e: MouseEvent) => this_.handleMakeNewMomentButtonPress(e)}
                        onSaveMoment={(e: MouseEvent) => this_.handleSaveCurrentMomentButtonPress(e)}
                        onTitleEditBlur={(e:React.ChangeEvent<HTMLTextAreaElement>) => this_.handleTitleEditBlur(e.target.value)}
                        isCurrent={aMoment === this_.timeline.currentMoment}
                        editingTitle={aMoment === this_.timeline.currentMoment && this.editingMomentTitle}
                        theText={aMoment.title}
                        hasNoCodapState={(aMoment.codapState === null)}
                        momentNumber={tMomentNumber}
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

        //  material about the focus area (deprecated) came from here. Removed for clarity.

        //  const theContent = (this.state.storyMode === "scrubber") ? momentsArea : focusArea;
        const theContent = momentsArea;
        const theStoryPanelStyle =  "story-panel-wide";
        //  const theStoryPanelStyle = (this.state.storyMode === "scrubber") ? "story-panel-wide" : "story-panel-tall";
        //  const controlArea = (this.state.storyMode === "scrubber") ? scrubberControlArea : focusControlArea;
        const controlArea = scrubberControlArea;
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
        await initializePlugin(kPluginName, kVersion, kInitialWideDimensions, this.restorePluginState)
            .catch(()=>{console.log(`••• problem initializing the plugin`)});

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

function InfoButton(props : any) {
    {/*   info button */}

    return (
        <div id="infoButton"
             className="story-child tool icon-button"
             onClick={props.onClick}
             title={"press to get some instructions"}
        >
            <img width={"28"} src={infoImage} alt={"?"} />
        </div>
    )
}

function DeleteButton(props : any) {
    {/*   info button */}

    return (
        <div id="deleteButton"
             className="story-child tool icon-button"
             onClick={props.onClick}
             title={"press to delete the current moment"}
        >
            {kTrashCan}
        </div>
    )
}
function NewMomentButton(props : any) {
    return (
        <div id="newMomentButton"
             className="story-child tool icon-button"
             onClick={props.onClick}
             title={"press to capture a new moment"}
        >
            <img width={"28"} src={shutterImage} alt={"snap!"}/>
        </div>
    )
}

export default DataStories;
