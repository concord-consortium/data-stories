import React, {Component} from 'react';
import codapInterface from "./lib/CodapInterface";
import {initializePlugin} from './lib/codap-helper';
import {Timeline} from './timeline';
import {MomentView, Moment} from './moment';
import './dataStories.css';

const kPluginName = "DataStories";
const kVersion = "0.1";
const kInitialWideDimensions = {
    width: 800,
    height: 100
};
const kInitialTallDimensions = {
    width: 333,
    height: 555
};

class StoryArea extends Component<{}, { numNotifications: number, stateID: number, storyMode: string }> {
    private timeline: Timeline = new Timeline(this);
    private restoreInProgress = false;
    private waitingForDocumentState = false;
    private makingMarker = false;

    constructor(props: any) {
        super(props);
        this.state = {numNotifications: 0, stateID: -1, storyMode: 'scrubber'};

        this.handleNotification = this.handleNotification.bind(this);
        this.clear = this.clear.bind(this);
        this.changeStoryMode = this.changeStoryMode.bind(this);
        this.startMakingMarker = this.startMakingMarker.bind(this);

        codapInterface.on('notify', '*', '', this.handleNotification);

        this.requestDocumentState();    // Get the initial state
        this.clear();
        console.log("Initial clear() completed. Initial mode is " + this.state.storyMode);
    }

    private requestDocumentState(): void {
        codapInterface.sendRequest({action: 'get', resource: 'document'});
        this.waitingForDocumentState = true;
    }

    private receiveNewDocumentState(iCommand: any): void {
        this.waitingForDocumentState = false;
        if (this.makingMarker) {
            this.finishMakingMarker(iCommand.values.state);
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

    /**
     * Reset the notifications array and force a redraw.
     */
    private clear(): void {
        this.timeline.initializeToCodapState(this.timeline.currentCodapState);
        console.log("In clear()");
        this.setState({stateID: this.state.stateID});
    };


    /**
     * Responsible for handling the various notifications we receive
     * when the user makes an undoable action,
     * and also when CODAP respomds to our requests to move to a different codapState
     *
     * @param iCommand    the Command resulting from the user action
     */
    private handleNotification(iCommand: any): void {
        if (iCommand.resource !== 'undoChangeNotice') {     //  ignore all of these
            if (iCommand.values.operation === 'newDocumentState') {
                if (this.waitingForDocumentState) {
                    this.receiveNewDocumentState(iCommand);
                }
            } else {
                this.timeline.handleNotification(iCommand);
            }
        }
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

    public async onMomentClick(e: MouseEvent, iID: number) {
        //  this.focusMomentIndex = iID;
        let tMoment = this.timeline.onMomentClick(iID);
        if (tMoment) {
            console.log('Click; go to moment [' + tMoment.title + ']');
            const theResult = await this.restoreCodapState(tMoment.codapState);
            this.forceRender();
        }
    }

    public startMakingMarker():void {
        this.requestDocumentState();
        this.makingMarker = true;
    }

    public  finishMakingMarker(iCodapState: any):void {
        this.makingMarker = false;
        this.timeline.makeMarkerOnDemand(iCodapState);
        this.forceRender();
    }

    public forceRender() {
        this.setState({numNotifications: this.timeline.length()});
    }

    public render() {
        let this_ = this;

        /*
        Begin with a div that can contain various controls;
        it's not part of the list of moments or the editing controls for a particular moment.
        */
        const controlArea = (
            <div className="control-area">
                <div className="message">use option-click to toggle marker status</div>

                {/*  start with the Focus button */}
                <div className="story-child clear-button"
                     onClick={this.changeStoryMode}
                     title={"press to focus on the current moment"}
                >
                    {this.state.storyMode === "scrubber" ? "focus" : "back to timeline"}
                </div>
                <div className="story-child clear-button"
                     onClick={this.startMakingMarker}
                     title={"mark the current state"}
                >
                    {"mark!"}
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
                        onClick={(e: MouseEvent) => this_.onMomentClick(e, aMoment.ID)}
                        isCurrent={aMoment.ID === this_.timeline.getCurrentIndex()}
                        theText={aMoment.title}
                        isMarker={aMoment.isMarker}
                    />
                )
            }
        );

        const momentsArea = (
            <div className="story-area">
                {theMoments}
            </div>
        );

        /*
        If we are editing (focusing on) a particular moment, we look in detail at that moment,
        which we call theFocusMoment.
         */
        const theFocusMoment: Moment | undefined = this.timeline.currentMoment();       //  focusMoment();

        const focusArea = (theFocusMoment !== undefined) ?
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
                                this.forceRender();
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
                            this.forceRender();
                        }}
                    />
                    <label htmlFor="checkboxSetMarker">Marker?</label>
                    <input
                        type="checkbox"
                        id="checkboxSetMarker"
                        checked={theFocusMoment.isMarker}
                        onChange={() => {
                            theFocusMoment.setMarker(!theFocusMoment.isMarker);
                            this.forceRender();
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

    constructor(props: any) {
        super(props);
        /*
                this.changeShape = this.changeShape.bind(this);
        */
        this.state = {shape: "wide"};
    }

    /**
     * LifeCycle method.
     * Calls initializePlugin from codap-helper.
     */
    public async componentWillMount() {
        await initializePlugin(kPluginName, kVersion, kInitialWideDimensions);

        const getComponentListMessage = {
            'action': 'get',
            'resource': 'componentList'
        };

        //  console.log('trying to get information on the plugin as a component with ' + JSON.stringify(getComponentListMessage));
        try {
            codapInterface.sendRequest(getComponentListMessage).then(
                (tResult: any) => {
                    const listResult = tResult.values;
                    console.log('the list result: ' + JSON.stringify(listResult));
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
                <StoryArea/>
            </div>
        );
    }

}

export default DataStories;
