import React from "react";

/*
interface IStringKeyedObject {
    [key: string]: string;
}
*/

export class Moment {

	public ID: number = -1;     //  todo: do we need this at all?
	public prev: Moment | null = null;
	public next: Moment | null = null;
	//  public codapStateDiff: [number, object][] = [];
	public codapState: object = {};

	public isMarker: boolean = false;
	public title: string = "";
	public created: Date;
	public narrative: string = "";

	constructor(iState: any) {
		this.codapState = iState;
		this.setTitle("moment");
		this.created = new Date();
	}

	createStorage() {
		return {
			ID: this.ID,
			codapState: this.codapState,
			isMarker: this.isMarker,
			title: this.title,
			created: this.created,
			narrative: this.narrative
		}
	}
	
	restoreFromStorage(iStorage: any) {
		this.ID = iStorage.ID;
		this.isMarker = iStorage.isMarker;
		this.title = iStorage.title;
		this.created = new Date(iStorage.created);
		this.narrative = iStorage.narrative;

	}


	setTitle(iTitle: string) {
		this.title = iTitle;
		//  this.setState({title:iTitle});
	}

	setMarker(iMarker: boolean) {
		this.isMarker = iMarker;
		//  this.setState({isMarker: iMarker});
	}

	setNarrative(iText: string) {
		this.narrative = iText;
	}
}

export function MomentView(props: any) {
	let theClasses = " story-child marker";
	if (props.isCurrent) theClasses += " current";
	return (
		<div id={"DSMarker" + props.id}
				 className={theClasses}
				 draggable
				 onDragStart={props.onDragStart}
				 onClick={props.onClick}
				 title={props.theText}
		>
			{props.theText}
		</div>
	);
}