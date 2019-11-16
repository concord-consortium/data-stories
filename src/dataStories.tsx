import React, {Component} from 'react';
import jiff from 'jiff';
import codapInterface from "./lib/CodapInterface";
import {initializePlugin} from './lib/codap-helper';
import './dataStories.css';

const kPluginName = "DataStories";
const kVersion = "0.1";
const kInitialDimensions = {
    width: 800,
    height: 100
};

/**
 * A type for an object; used in StoryArea.notifications, which is an Array of these things.
 *
 * NOTE: each notification will have either a codapState (if it's the first one) or a codapStateDiff (if it's not).
 * The codapStateDiff is the difference (computed by jiff) between that state and the previous one.
 * Thuis. to find the state you start at the beginning and implement the diffs until you get to that spot
 * in the array. This takes place in moveCodapState (below)
 */
type notification = {
    message: string,
    ID: number,
    prev: number,
    next: number,
    isMarker: Boolean,
    codapStateDiff: [number, object][]
};

interface IStringKeyedObject {
    [key: string]: string;
}

class StoryArea extends Component<{}, { numNotifications: number, stateID: number }> {
    private initialCodapState: object | null = null;
    private notifications: notification[] = [];
    private startingNotificationIndex = -1;
    private currentNotificationIndex = -1;
    private waitingForCodapState = false;	// When true, we expect CODAP to notify us of a new state
    private currentCodapState: object | null = null;
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
        this.state = {numNotifications: 0, stateID: -1};

        this.handleNotification = this.handleNotification.bind(this);
        this.clear = this.clear.bind(this);
        codapInterface.on('notify', '*', '', this.handleNotification);
        // Get the initial state
        codapInterface.sendRequest({
            action: 'get',
            resource: 'document'
        }).then(() => {
            this.clear()
        });

    }

    /**
     * Reset the notifications array and force a redraw.
     */
    private clear(): void {
        let tCurrentNotificationIndex = this.state.stateID;

        if (tCurrentNotificationIndex < 0) tCurrentNotificationIndex = 0;
        this.startingNotificationIndex = tCurrentNotificationIndex;

        this.initialCodapState = this.currentCodapState;
        console.log("Reset to current state");

        /* Create a single (start) notification with a blank "diff" */
        this.notifications = [{
            message: 'start',
            ID: tCurrentNotificationIndex,
            prev: -1,
            next: -1,
            isMarker: true,
            codapStateDiff: []
        }];

        this.setState({stateID: tCurrentNotificationIndex});
    };

    /**
     * Adjusts the array of notifications.
     * Note that this.currentCodapState is the member object referring to the last SAVED state.
     * the parameter iCodapState is the actual current state, more recent than "this.currentCodapState."
     *
     * So this method finds the difference between the old current state,
     * and installs that difference in a fresh notification in its codapStateDiff.
     *
     * This is called ONLY by newDocumentState.
     *
     * @param iCodapState    the actual current state of CODAP
     */
    private storeCodapState(iCodapState: object): void {
        if (!this.initialCodapState) {
            this.initialCodapState = iCodapState;
        } else if (this.restoreInProgress || !this.waitingForCodapState)
            return;
        else {
            this.waitingForCodapState = false;
            //	find the last (i.e., previous) notification in the array
            let tNumNotifications = this.notifications.length,
                tLastNotification = (tNumNotifications > 0) ? this.notifications[tNumNotifications - 1] : null;
            if (tLastNotification) {
                if (tLastNotification.codapStateDiff.length > 0) {
                    window.alert('Expected empty array for codapStateDiff');
                    debugger;
                }
                //	find the difference between the "currentCodapState" and store it in the .codapStateDiff field.
                tLastNotification.codapStateDiff = jiff.diff(this.currentCodapState, iCodapState);
            }
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
            let message = '',
                numCases = 0;

            iCommand.values.type = this.componentMap[iCommand.values.type] || iCommand.values.type;
            switch (iCommand.values.operation) {
                case 'createCases':
                    numCases = iCommand.values.result.caseIDs.length;
                    message = 'create ' + numCases + (numCases > 1 ? ' cases' : ' case');
                    break;
                case 'create':
                    message = 'create ' + formComponentMessage();
                    break;
                case 'delete':
                    message = 'delete ' + formComponentMessage();
                    break;
                case 'beginMoveOrResize':
                    break;
                case 'move':
                case 'resize':
                    message = iCommand.values.operation + ' ' + formComponentMessage();
                    break;
                case 'selectCases':
                    if (iCommand.values.result.cases) {
                        numCases = iCommand.values.result.cases.length;
                        message = 'select ' + numCases + ' case' + (numCases > 1 ? 's' : '');
                    }
                    break;
                case 'hideSelected':
                    message = 'hide selected cases';
                    break;
                case 'attributeChange':
                    message = 'plot attribute "' + iCommand.values.attributeName + '" on graph';
                    break;
                case 'legendAttributeChange':
                    message = 'plot attribute "' + iCommand.values.attributeName + '" on graph legend';
                    break;
                case 'edit':
                    message = 'edit ' + iCommand.values.title;
                    break;
                case 'newDocumentState':
                    this.storeCodapState(iCommand.values.state);
                    break;
                default:
                    if (iCommand.values.globalValue) {

                    } else
                        message = iCommand.values.operation;
            }
            if (message !== '') {
                let oldID: number = this.state.stateID;
                let newID: number = this.notifications.length;  //  the index of the NEXT notification
                this.notifications.push({
                    message: message,
                    ID: newID,
                    prev: oldID,
                    next: -1,
                    isMarker: false,
                    codapStateDiff: []
                });
                if (oldID >= 0) this.linkFromOlderNotification(oldID, newID);

                this.waitingForCodapState = true;
                this.setState({numNotifications: this.notifications.length, stateID: newID});
            }
        }
    }

    /**
     * Maintenance of the linked list fields in this.notifications.
     *
     * @param iOlderID
     * @param iCurrentID
     */
    private linkFromOlderNotification(iOlderID: number, iCurrentID: number) {
        let tOldNotification = this.notifications.find((n) => n.ID === iOlderID) as notification;
        tOldNotification.next = iCurrentID;
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

        // Detect situations in which we're trying to patch out of sequence
        function testPatch(iDiff: object, iState: object | null) {
            try {
                jiff.patch(iDiff, iState);
                return true;
            } catch (e) {
                window.alert(e);
                debugger;
                return false;
            }
        }

        let tNotification = this.notifications.find(function (iNotification) {
            return iNotification.ID === iID;
        });
        if (tNotification) {
            let tCodapState = this.initialCodapState,
                tIndex = this.startingNotificationIndex,
                tDone = false;
            while (!tDone && tIndex >= 0) {     //  because xxx.next = -1 if we're at the end
                const tCurrentNotification = this.notifications[tIndex];
                if (testPatch(tCurrentNotification.codapStateDiff, tCodapState)) {
                    tCodapState = jiff.patch(tCurrentNotification.codapStateDiff, tCodapState);
                }
                tDone = tCurrentNotification.ID === iID;
                tIndex = tCurrentNotification.next;
            }
            await this.restoreCodapState(tCodapState);
            this.setState({stateID: iID});
        } else {
            window.alert("Notification not found");
        }
    }

    public onStoryEventClick(e: MouseEvent, iID: number) {
        let this_ = this;
        let tNotification = this.notifications.find(function (n) {
            return n.ID === iID
        });
        if (tNotification) {
            if (e.altKey) {
                tNotification.isMarker = !tNotification.isMarker;
                console.log("alt click on " + iID + "; swap marker value!");
                this.forceRender();
            } else {
                console.log('Click; go to marker [' + tNotification.message + ']');
                this_.moveCodapState(iID);
            }
        }
    }

    public forceRender() {
        this.setState({numNotifications: this.notifications.length});
    }

    public render() {
        let this_ = this;

        /*
        Loop over all notifications; make a StoryEvent for each.
        this.notifications is now a linked list, so we traverse the list...
        */

        let theNotifications = [];
        let tIndex = this.startingNotificationIndex;

        while (tIndex >= 0) {     //  because xxx.next = -1 if we're at the end
            const tCurrentNotification = this.notifications[tIndex];
            theNotifications.push(tCurrentNotification);
            tIndex = tCurrentNotification.next;
        }
        /*
            ... to create theNotifications, an Array of the relevant notifications,
            that is, all notifications that are in the current timeline, past and future :)

            Then we loop through that new Array to make the event widgets
        */


        const theEvents = theNotifications.map(
            (aNotification) => {
                const tID = aNotification.ID;
                return (
                    <StoryEvent
                        key={tID}
                        ID={tID}
                        onClick={(e: MouseEvent) => this_.onStoryEventClick(e, tID)}
                        theText={aNotification.message}
                        isMarker={aNotification.isMarker}
                        isCurrent={tID === this_.state.stateID}
                    />
                )
            }
        );

        return (
            <div>
                <div className="story-panel">
                    <div className="message">use option-click to toggle marker status</div>
                    <div className="story-area">

                        {/*  start with the Clear button */}
                        <div className="story-child clear-button"
                             onClick={this.clear}
                             title={"press to clear all of your markers"}
                        >
                            Clear
                        </div>

                        {/*  now the storyEvents */}
                        {theEvents}
                    </div>
                </div>

            </div>
        );
    }
}

function StoryEvent(props: any) {
    //	console.log("Rendering event " + props.ID + " (" + props.theText + ")");
    let theClasses = props.isMarker ? "story-child marker" : "story-child event";
    if (props.isCurrent) theClasses += " current";
    return (
        <div className={theClasses}
             onClick={props.onClick}
             title={props.theText}
        >
            {props.theText}
        </div>
    );
}

/**
 * Top-level "App" component.
 * Represents the whole iFrame; contains the <StoryArea>
 */
class DataStories
    extends Component {

    constructor(props: any) {
        super(props);
    }

    /**
     * LifeCycle method.
     * Calls initializePlugin from codap-helper.
     */
    public async componentWillMount() {
        await initializePlugin(kPluginName, kVersion, kInitialDimensions);

        const getComponentListMessage = {
            'action': 'get',
            'resource': 'componentList'
        };

        console.log('trying to get information on the plugin as a component with ' + JSON.stringify(getComponentListMessage));
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
                    const positionMessage = {
                        'action': 'update',
                        'resource': 'component[' + thePluginID + ']',
                        'values': {'position': 'bottom'}
                    };
                    console.log('trying to position the plugin with ' + JSON.stringify(positionMessage));
                    codapInterface.sendRequest(positionMessage).then(
                        (res) => {
                            console.log('Positioning result: ' + JSON.stringify(res));
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
