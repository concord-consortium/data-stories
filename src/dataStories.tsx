import React, {Component} from 'react';
import codapInterface from "./lib/CodapInterface";
import {initializePlugin} from './lib/codap-helper';
import {StoryEventSet} from './story-event-set';
import {StoryEvent, StoryEventModel} from './story-event';
import './dataStories.css';
import jiff from "jiff";

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

/*
Problems pending as of Thanksgiving morning

I have created the storyMode member thingy to distinguish the purpose from the "shape."
I suspect that we need to possibly save the shape and compare it to the mode in render() and make the shape change then rather than in changeStoryMode.
We are sometimes seeing the scrubber events in "tall" mode. Or rather, we are somehow getting into :"wide" without changing the shape.

Worse, some obvious events are getting created (create slider) but then not being properly restored.
How can that happen when it was working before??
 */

interface IStringKeyedObject {
    [key: string]: string;
}

class StoryArea extends Component<{}, { numNotifications: number, stateID: number, storyMode: string }> {
    private currentCodapState: object | null = null;   //      todo: do we need this here?
    private storyEvents: StoryEventSet = new StoryEventSet( this );
    private waitingForCodapState = false;	// When true, we expect CODAP to notify us of a new state
    private restoreInProgress = false;
    private componentMap: IStringKeyedObject = {
        'DG.GameView': 'plugin',
        'DG.GraphView': 'graph',
        'DG.MapView': 'map',
        'DG.SliderView': 'slider',
        'DG.TextView': 'text',
        'DG.Calculator': 'calculator',
        'DG.TableView': 'case table',
        'DG.CaseCard': 'case card',
        'calcView': 'Calculator'
    };

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
        this.storyEvents.initializeToCodapState(this.currentCodapState);
        console.log("In clear()");
        this.setState({stateID: this.state.stateID});
    };

    /**
     * todo: consider how much could be moved to the storyEventSet; especially the currentCodapState
     *
     * @param iCodapState
     */
    private storeCodapState(iCodapState: object): void {
        if (this.restoreInProgress || !this.waitingForCodapState) return;

        if (!this.storyEvents.initialCodapState) {
            this.storyEvents.initialCodapState = iCodapState;
        } else {
            this.waitingForCodapState = false;
            const theCurrentEvent = this.storyEvents.currentStoryEvent();
            if (theCurrentEvent) theCurrentEvent.codapStateDiff = jiff.diff(this.currentCodapState, iCodapState);
        }
        this.currentCodapState = iCodapState;
    }

    /**
     * The Kahuna of this component;
     * responsible for handling the various notifications we receive
     * when the user makes an undoable action.
     *
     * @param iCommand    the Command resulting from the user action
     */
    private handleNotification(iCommand: any): void {
        function formComponentMessage() {
            let cMsg = '',
                cTitle = ' ' + (iCommand.values.title || '');
            if (iCommand.values.type === 'calculator') {
                cMsg = 'Calculator'
            } else {
                cMsg = iCommand.values.type + cTitle;
            }
            return cMsg;
        }

        if (this.restoreInProgress)
            return;
        if (iCommand.resource !== 'undoChangeNotice') {
            let notificationTitle = '',
                numCases = 0;

            iCommand.values.type = this.componentMap[iCommand.values.type] || iCommand.values.type;
            switch (iCommand.values.operation) {
                case 'createCases':
                    numCases = iCommand.values.result.caseIDs.length;
                    notificationTitle = 'create ' + numCases + (numCases > 1 ? ' cases' : ' case');
                    break;
                case 'create':
                    notificationTitle = 'create ' + formComponentMessage();
                    break;
                case 'delete':
                    notificationTitle = 'delete ' + formComponentMessage();
                    break;
                case 'beginMoveOrResize':
                    break;
                case 'move':
                case 'resize':
                    notificationTitle = iCommand.values.operation + ' ' + formComponentMessage();
                    break;
                case 'selectCases':
                    if (iCommand.values.result.cases) {
                        numCases = iCommand.values.result.cases.length;
                        notificationTitle = 'select ' + numCases + ' case' + (numCases > 1 ? 's' : '');
                    }
                    break;
                case 'hideSelected':
                    notificationTitle = 'hide selected cases';
                    break;
                case 'attributeChange':
                    notificationTitle = 'plot attribute "' + iCommand.values.attributeName + '" on graph';
                    break;
                case 'legendAttributeChange':
                    notificationTitle = 'plot attribute "' + iCommand.values.attributeName + '" on graph legend';
                    break;
                case 'edit':
                    notificationTitle = 'edit ' + iCommand.values.title;
                    break;
                case 'newDocumentState':
                    this.storeCodapState(iCommand.values.state);
                    break;
                default:
                    if (iCommand.values.globalValue) {

                    } else
                        notificationTitle = iCommand.values.operation;
            }
            /*
            The idea is this: When the user does something undoable (e.g., create slider)
            the first notification is for that creation; at that point we create a new StoryEvent for that and
            append it to the list.
            LATER, CODAP has figured out the new state of the document, and issues a newDocumentState notification,
            at which point we compute the difference from the previous document state and insert it (storeCodapStae())
            in the StoryEvent that we just created in its codapStateDiff field.
             */
            if (notificationTitle !== '') {
                const tEvent = this.storyEvents.addNewStoryEvent(notificationTitle);
                this.waitingForCodapState = true;
                this.setState({numNotifications: this.storyEvents.length(), stateID: tEvent.ID});
            }
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
    private async moveCodapState(iID: number) {

        const tCodapState: any | null = this.storyEvents.getStateByStoryEventID(iID);

        if (tCodapState) {
            await this.restoreCodapState(tCodapState);
            const theComponents = tCodapState["components"];
            console.log("   restored with components: " + theComponents.reduce((a: string, v: any) => {
                return (a + v.type + " ");
            }));
            this.setState({stateID: iID});
        } else {
            window.alert("Notification not found");
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
                this_.moveCodapState(iID);
            }
        }
    }

    public forceRender() {
        this.setState({numNotifications: this.storyEvents.length()});
    }

    public render() {
        let this_ = this;

        /*
        Loop over all notifications; make a StoryEvent for each.
        this.notifications is now a linked list, so we traverse the list
        to create theNotifications, an Array of the _relevant_ notifications,
        that is, all notifications that are in the current timeline, past and future :)
        */

        const storyEventsOnThisTimeline = this.storyEvents.storyEventsOnThisTimeline();
        const theFocusStoryEvent: StoryEventModel | undefined = this.storyEvents.focusStoryEvent();

        /*
            Then we loop through that new Array to make the event widgets
        */
        const theEvents = storyEventsOnThisTimeline.map(
            (aSE) => {
                const tID = aSE.ID;
                return (
                    <StoryEvent
                        key={aSE.ID}
                        onClick={(e: MouseEvent) => this_.onStoryEventClick(e, tID)}
                        isCurrent={tID === this_.state.stateID}
                        theText={aSE.title}
                        isMarker={aSE.isMarker}
                    />
                )
            }
        );

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

        const eventsArea = (
            <div className="story-area">
                {theEvents}
            </div>
        );

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
                            const theElement = document.getElementById("checkboxSetMarker");
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
