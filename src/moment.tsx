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
	public narrative: any = "";

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
		this.codapState = iStorage.codapState;
		this.isMarker = iStorage.isMarker;
		this.title = iStorage.title;
		this.created = new Date(iStorage.created);
		this.narrative = iStorage.narrative;

	}

	toString() : string {
		return `ID: ${this.ID} title: [${this.title}] narrative: ${this.extractNarrative()}`;
	}

	setCodapState(iCodapState: object) {
		this.codapState = iCodapState;
	}

	setTitle(iTitle: string) {
		this.title = iTitle;
	}

	setMarker(iMarker: boolean) {
		this.isMarker = iMarker;
	}

	setNarrative(iText: string) {
		this.narrative = iText;
	}

	extractNarrative() : string {
		if (this.narrative.document) {
			return this.narrative.document.children[0].children[0].text;
		} else {
			return "(txt) " + this.narrative;
		}
	}
}

export function MomentView(props: any) {
	let theClasses = " story-child marker";
	if (props.isCurrent) theClasses += " current";
	if (props.hasNoCodapState) theClasses += " unsavedMoment";
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

