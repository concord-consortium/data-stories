import React, {Component} from 'react';
import jiff from 'jiff';
import codapInterface from "./lib/CodapInterface";
import {initializePlugin} from './lib/codap-helper';
import './dataStories.css';

const kPluginTitle = "Data Stories";
const kPluginName = "DataStories";
const kVersion = "0.1";
const kInitialDimensions = {
    width: 700,
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
    codapState: object | null,
    codapStateDiff: [number, object][]
};

interface IStringKeyedObject {
    [key: string]: string;
}

class StoryArea extends Component<{}, { numNotifications: number, stateID: number }> {
    private notifications: notification[] = [];
    private currentState: object | null = null;
    private restoreInProgress = false;
    private componentMap: IStringKeyedObject = {
        'DG.GameView': 'plugin',
        'DG.GraphView': 'graph',
        'DG.MapView': 'map',
        'DG.SliderView': 'slider',
        'DG.TextView': 'text',
        'DG.Calculator': 'calculator',
        'DG.TableView': 'case table',
        'DG.CaseCard': 'case card'
    };

    constructor(props: any) {
        super(props);
        this.state = {numNotifications: 0, stateID: 0};

        this.handleNotification = this.handleNotification.bind(this);
        this.clear = this.clear.bind(this);
        codapInterface.on('notify', '*', '', this.handleNotification);
    }

    /**
     * Reset the notifications array and issue a React setState() to force a redraw.
     */
    private clear(): void {
        console.log("Clear clicked");
        this.notifications = [{
            message: 'start', ID: 0, codapState: this.currentState, codapStateDiff: []
        }];
        this.setState({numNotifications: this.notifications.length});
    }

    /**
     * Adjusts the array of notifications.
     * Note that this.currentState is the member object referring to the last SAVED state.
     * the parameter iState is the actual current state, more recent than "this.currentState."
     *
     * So this method finds the difference between the old current state,
     * and installs that difference in a fresh notification in its codapStateDiff.
     *
     * This is called ONLY by newDocumentState.
     *
     * @param iState    the actual current state of CODAP
     */
    private storeState(iState: object): void {
        if (this.restoreInProgress)
            return;

        //	find the last (i.e., previous) notification in the array
        let tNumNotifications = this.notifications.length,
            tLastNotification = (tNumNotifications >= 0) ? this.notifications[tNumNotifications - 1] : null;
        if (tLastNotification) {
            if (this.currentState === null) {
                //	this is the first notification, so the codapState is simply the input state.
                tLastNotification.codapState = iState;
            } else {
                //	find the difference between the "currentState" and store it in the .codapStateDiff field.
                //	todo: but shouldn't it be in some NEW notification rather than the last one?
                tLastNotification.codapStateDiff = jiff.diff(this.currentState, iState);
                let test = JSON.stringify(jiff.patch(tLastNotification.codapStateDiff, this.currentState)) ===
                    JSON.stringify(iState);
                console.log(test ? "notification " + tLastNotification.ID + " (" + tLastNotification.message + ") checks out" :
                    "notification " + tLastNotification.ID + " failed in storeState()");
            }
            this.currentState = iState;
        }
    }

    /**
     * The Kahuna of this component;
     * responsible for handling the various notifications we receive
     * when the user makes an undoable action.
     *
     * @param iCommand    the Command resulting from the user action
     */
    private handleNotification(iCommand: any): void {
        if (this.restoreInProgress)
            return;
        if (iCommand.resource !== 'undoChangeNotice') {
            let message = '',
                numCases = 0,
                title = ' ' + (iCommand.values.title || '');
            iCommand.values.type = this.componentMap[iCommand.values.type] || iCommand.values.type;
            switch (iCommand.values.operation) {
                case 'createCases':
                    numCases = iCommand.values.result.caseIDs.length;
                    message = 'create ' + numCases + (numCases > 1 ? ' cases' : ' case');
                    break;
                case 'create':
                    message = 'create ' + iCommand.values.type + title;
                    break;
                case 'delete':
                    message = 'delete ' + iCommand.values.type + title;
                    break;
                case 'beginMoveOrResize':
                    break;
                case 'move':
                case 'resize':
                    message = iCommand.values.operation + ' ' + iCommand.values.type + title;
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
                case 'newDocumentState':
                    this.storeState(iCommand.values.state);
                    break;
                default:
                    if (iCommand.values.globalValue) {

                    } else
                        message = iCommand.values.operation;
            }
            if (message !== '') {
                let newID: number = this.state.stateID;
                this.notifications.push({
                    message: message,
                    ID: newID,
                    codapState: {},
                    codapStateDiff: []
                });
                let newNumNotifications = this.notifications.length;
                this.setState({numNotifications: newNumNotifications, stateID: newID + 1});
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
            this.restoreInProgress = true;
            codapInterface.sendRequest({
                action: 'update',
                resource: 'document',
                values: iCodapState
            }).then(() => {
                this.restoreInProgress = false;
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
    private moveCodapState(iID: number) {
        console.log("moveCodapState(" + iID + ")");

        let tNotification = this.notifications.find(function (iNotification) {
            return iNotification.ID === iID;
        });
        if (tNotification) {
            let tCodapState = this.notifications[0].codapState,
                tIndex = 0,
                tDone = false;
            while (!tDone && tIndex < this.notifications.length) {
                tCodapState = jiff.patch(this.notifications[tIndex].codapStateDiff, tCodapState);
                tDone = this.notifications[tIndex].ID === iID;
                tIndex++;
            }
            this.restoreCodapState(tCodapState);
        }
    }

    public render() {
        let this_ = this;

        {/*loop over all notifications; make a Marker for each*/}
        const theMarkers = this_.notifications.map(
            (aNotification) => {
                const tID = aNotification.ID;
                return (
                    <Marker
                        key={tID}
                        ID={tID}
                        onClick={() => this_.moveCodapState(tID)}
                        theText={aNotification.message}
                    />
                )
            }
        );

        return (
            <div>
                <div className="story-area">
                    <div className="story-child clear-button"
                         onClick={this.clear}
                         title={"press to clear all of your markers"}
                    >Clear</div>
                    {theMarkers}
                    {/*finally, the clear button*/}
                </div>

            </div>
        );
    }
}

function Marker(props: any) {
    console.log("Rendering marker " + props.ID + " (" + props.theText + ")");
    return (
        <div className="story-child marker"
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
            'action' : 'get',
            'resource' : 'componentList'
        };

        console.log('trying to get information on the plugin as a component with ' + JSON.stringify(getComponentListMessage));
        try {
            codapInterface.sendRequest(getComponentListMessage).then(
                (tResult : any) => {
                    const listResult = tResult.values;
                    console.log('the list result: ' + JSON.stringify(listResult));
                    let thePluginID = null;
                    listResult.forEach((c : any) => {
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
        } catch(err) {
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
