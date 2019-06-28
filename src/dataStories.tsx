import React, {Component} from 'react';
import jiff from 'jiff';
import codapInterface from "./lib/CodapInterface";
import {initializePlugin} from './lib/codap-helper';
import './dataStories.css';

const kPluginName = "Data Stories";
const kVersion = "0.1";
const kInitialDimensions = {
	width: 300,
	height: 500
};

type notification = {message: string, ID: number, codapState: object, codapStateDiff: [number,object][] };

class StoryArea extends Component<{}, { numNotifications: number, stateID: number }> {
	private notifications: notification[] = [];
	private currentState: object|null = null;

	constructor(props: any) {
		super(props);
		this.state = {numNotifications: 0, stateID: 0 };

		this.handleNotification = this.handleNotification.bind(this);
		this.clear = this.clear.bind(this);
		codapInterface.on('notify', '*', '', this.handleNotification);
	}

	private clear(): void {
		this.notifications = [];
		this.setState({numNotifications: 0});
	}

	private getCodapState( iStateID: number): void {
		codapInterface.sendRequest( {
			action: 'get',
			resource: 'document',
			values: {
				stateID: iStateID
			}
		}).then((result) => {
			console.log('request for state sent and result returned');
		});
	}

	private storeState( iStateID: number, iState: object): void {
		let tFoundNotification = this.notifications.find((iNotification)=>{
			return iNotification.ID === iStateID;
		});
		if( tFoundNotification) {
			if( this.currentState === null) {
				tFoundNotification.codapState = iState;
			}
			else {
				tFoundNotification.codapStateDiff = jiff.diff( this.currentState, iState);
				let test = JSON.stringify(jiff.patch( tFoundNotification.codapStateDiff, this.currentState)) ===
					JSON.stringify(iState);
				console.log(test);
			}
			this.currentState = iState;
		}
	}

	private handleNotification(iCommand: any): void {
		if (iCommand.resource !== 'undoChangeNotice') {
			let message = '',
				numCases = 0;
			switch (iCommand.values.operation) {
				case 'createCases':
					numCases = iCommand.values.result.caseIDs.length;
					message = 'create ' + numCases + (numCases > 1 ? ' cases' : ' case');
					break;
				case 'create':
					message = 'create ' + iCommand.values.type;
					break;
				case 'beginMoveOrResize':
					break;
				case 'move':
				case 'resize':
					message = iCommand.values.operation + ' ' + iCommand.values.type;
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
				case 'getDocumentState':
					this.storeState( iCommand.values.id, iCommand.values.state);
					break;
				default:
					if (iCommand.values.globalValue) {

					}
					else
						message = iCommand.values.operation;
			}
			if (message !== '') {
				let newID:number = this.state.stateID + 1;
				this.notifications.push({
					message: message,
					ID: newID,
					codapState: {},
					codapStateDiff: []
				});
				let newNumNotifications = this.notifications.length;
				this.setState({numNotifications: newNumNotifications, stateID: newID });
				this.getCodapState( newID);
			}
		}
	}

	public render() {
		return (
			<div>
				<div className="story-area">
					<ol>
						{this.notifications.map((iNotification, iIndex) => {
							return (
								<li key={iIndex}>{iNotification.message}</li>
							)
						})}
					</ol>
				</div>
				<button onClick={this.clear}>Clear</button>
			</div>
		);
	}
}

class DataStories
	extends Component {

	constructor(props: any) {
		super(props);
	}

	public componentWillMount() {
		initializePlugin(kPluginName, kVersion, kInitialDimensions).then(function () {
		});
	}

	public render() {

		return (
			<div className="App">
				<span className="title"> Welcome to Data Stories </span>
				<StoryArea/>
			</div>
		);
	}

}

export default DataStories;
