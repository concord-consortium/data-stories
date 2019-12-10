import React, {Component} from 'react';
import codapInterface from "./lib/CodapInterface";
import {initializePlugin} from './lib/codap-helper';
import {StoryEventSet} from './story-event-set';
import {StoryEvent, StoryEventModel} from './story-event';
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


interface IStringKeyedObject {
    [key: string]: string;
}

class StoryArea extends Component<{}, { numNotifications: number, stateID: number, storyMode: string }> {
    private storyEvents: StoryEventSet = new StoryEventSet( this );
    private waitingForCodapState = false;	// When true, we expect CODAP to notify us of a new state
    private restoreInProgress = false;

    constructor(props: any) {
        super(props);
        this.state = {numNotifications: 0, stateID: -1, storyMode: 'scrubber'};

        this.handleNotification = this.handleNotification.bind(this);
        this.clear = this.clear.bind(this);
        this.changeStoryMode = this.changeStoryMode.bind(this);

        codapInterface.on('notify', '*', '', this.handleNotification);
        // Get the initial state
        codapInterface.sendRequest({
            action: 'get',
            resource: 'document'
        }).then(() => {
            this.clear();
            console.log("Initial clear() completed.");
        });

        console.log("Initial mode is " + this.state.storyMode);
    }

    /**
     * Toggle story mode between `scrubber` and `focus`.
     * Change the shape of the Iframe, then change the (React) state;
     * then, on render(), actually display different material (e.g., detailed info on an event when `state.storyMode` is `scrubber`.)
     */
    private changeStoryMode(): void {

        const newMode = (this.state.storyMode === 'focus') ? 'scrubber' : 'focus';
        this.storyEvents.setFocusIndex((newMode === 'focus') ? this.state.stateID : -1);

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
        this.storyEvents.initializeToCodapState(this.storyEvents.currentCodapState);
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
        if (this.restoreInProgress)
            return;

        const handlerResult:any = this.storyEvents.handleNotification(iCommand);

        //  this.waitingForCodapState = handlerResult.waiting;

        if (handlerResult.doSetState) {
            this.setState({
                numNotifications: this.storyEvents.length(),
                stateID: this.storyEvents.length()});
        }

    }


    /**
     * Asks CODAP to restore itself to the given state.
     * Note: sets restoreInProgress while it's running and resolving its promises
     *
     * @param iCodapState    the state to restore to; this is the potentially large JSON object
     */
    private restoreCodapState(iCodapState: object | null) {
        if (iCodapState) {
            let this_ = this;
            this.restoreInProgress = true;
            codapInterface.sendRequest({
                action: 'update',
                resource: 'document',
                values: iCodapState
            }).then(() => {
                this_.restoreInProgress = false;
            });
        }
    }

    /**
     * Called when the user presses the "go" button to select and implement a particular state.
     * We get the notification number to go to, then reconstruct the state
     * by looping though the notification array until we get to the given notification number.
     *
     * @param iID    the notification ID (which was set in React as the argument in the button's onChange() )
     */
    private async travelToCodapStateByEventNumber(iID: number) {

        const tCodapState: any | null = this.storyEvents.constructStateToTravelTo(iID);

        if (tCodapState) {
            await this.restoreCodapState(tCodapState);
            console.log("   restored to: " + this.storyEvents.stateInfoString(tCodapState));
            this.storyEvents.setCurrentIndex(iID);
            this.setState({stateID: iID});
        } else {
            window.alert("trying to time-travel but could not find event " + iID);
        }
    }

    public onStoryEventClick(e: MouseEvent, iID: number) {
        //  this.focusEventIndex = iID;
        let this_ = this;
        let tStoryEvent = this.storyEvents.storyEventByStoryEventID(iID);
        if (tStoryEvent) {
            if (e.altKey) {
                tStoryEvent.setMarker(!tStoryEvent.isMarker);
                console.log("alt click on " + iID + "; swap marker value!");
                //  this.forceRender();
            } else {
                console.log('Click; go to event [' + tStoryEvent.title + ']');
                this_.travelToCodapStateByEventNumber(iID);
            }
        }
    }

    public forceRender() {
        this.setState({numNotifications: this.storyEvents.length()});
    }

    public render() {
        let this_ = this;

        /*
        Begin with a div that can contain various controls;
        it's not part of the list of events or the editing controls for a particular event.
        */
        const controlArea = (
            <div className="control-area">
                <div className="message">use option-click to toggle marker status</div>

                {/*  start with the Focus button */}
                <div className="story-child clear-button"
                     onClick={this.changeStoryMode}
                     title={"press to focus on the current event"}
                >
                    {this.state.storyMode === "scrubber" ? "Focus" : "back to timeline"}
                </div>
            </div>
        );

        /*
        Loop over all story events; make a StoryEvent for each.
        this.storyEvents.storyEvents is now a linked list, so we traverse the list
        to create theEvents, an Array of the _relevant_ storyEvents,
        that is, all storyEvents that are in the current timeline, past and future :)
        */

        const storyEventsOnThisTimeline = this.storyEvents.storyEventsOnThisTimeline();

        /*
            Then we loop through that new Array to make the event widgets
        */
        const theEvents = storyEventsOnThisTimeline.map(
            (aSE) => {
                return (
                    <StoryEvent
                        key={aSE.ID}
                        onClick={(e: MouseEvent) => this_.onStoryEventClick(e, aSE.ID)}
                        isCurrent={aSE.ID === this_.storyEvents.getCurrentIndex()}
                        theText={aSE.title}
                        isMarker={aSE.isMarker}
                    />
                )
            }
        );

        const eventsArea = (
            <div className="story-area">
                {theEvents}
            </div>
        );

        /*
        If we are editing (focusing on) a particular event, we look in detail at that event,
        which we call theFOcusStoryEvent.
         */
        const theFocusStoryEvent: StoryEventModel | undefined = this.storyEvents.focusStoryEvent();

        const focusArea = (theFocusStoryEvent !== undefined) ?
            (
                <div className="focus-area">
                    <p>
                        Event {theFocusStoryEvent.ID}:&nbsp;
                        <b>{theFocusStoryEvent.title}</b>&nbsp;
                        ({theFocusStoryEvent.created.toLocaleTimeString()})
                    </p>
                    <label htmlFor="checkboxSetMarker">Marker?</label>
                    <input
                        type="checkbox"
                        id="checkboxSetMarker"
                        checked={theFocusStoryEvent.isMarker}
                        onChange={() => {
                            theFocusStoryEvent.setMarker(!theFocusStoryEvent.isMarker);
                            this.forceRender();
                        }}
                    />
                    <br/>
                    narrative:<br/>
                    <textarea
                        rows={5}
                        value={theFocusStoryEvent.narrative}
                        onChange={(e) => {
                            const theText: string = e.target.value;
                            theFocusStoryEvent.setNarrative(theText);
                            this.forceRender();
                        }}
                    />
                </div>
            ) : (
                <div className="focus-area">
                    <p>There is no event to report on; the focus event was found in the list!</p>
                </div>
            );

        const theContent = (this.state.storyMode === "scrubber") ? eventsArea : focusArea;
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
                        'values': {'position': positionValues, 'cannotClose' : true}
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
