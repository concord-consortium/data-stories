import React from "react";

/*
interface IStringKeyedObject {
    [key: string]: string;
}
*/

export class MomentModel {
    public ID: number = 0;
    public prev: MomentModel | null = null;
    public next: MomentModel | null = null;
    //  public codapStateDiff: [number, object][] = [];
    public codapState: object = {};

    public isMarker: boolean = false;
    public title: string = "";
    public created: Date = new Date();
    public modified: Date = new Date();
    public narrative: any = "";

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

    toString(): string {
        return `ID: ${this.ID} title: [${this.title}] narrative: ${this.extractNarrative()}`;
    }

    setCodapState(iCodapState: object) {
        this.codapState = iCodapState;
    }

    setTitle(iTitle: string) {
        this.title = iTitle;
    }

    /*
        setMarker(iMarker: boolean) {
            this.isMarker = iMarker;
        }
    */

    setNarrative(iText: string) {
        this.narrative = iText;
    }

    extractNarrative(): string {
        if (this.narrative.document) {
            return this.narrative.document.children[0].children[0].text;
        } else {
            return "(txt) " + this.narrative;
        }
    }

}

export function Moment(props: any) {
    let theClasses = " story-child marker";
    if (props.isCurrent) theClasses += " current";
    if (props.hasNoCodapState) theClasses += " unsavedMoment";

    const controlZoneGuts = props.isCurrent ?
		(
			<div className={"moment-control-zone"}>
				<DeleteButton onDelete = {props.onDelete} />
				<RevertButton onRevert = {props.onRevert} />
				<SaveButton onSaveMoment = {props.onSaveMoment} />
				<NewMomentButton onNewMoment = {props.onNewMoment} />
			</div>
		) :
		"";

    return (
        <div id={"DSMarker" + props.id}
             className={theClasses}
             draggable
             onDragStart={props.onDragStart}
             onClick={props.onClick}
             title={props.theText}
        >
			<div className={"moment-title-zone"}>
                {props.theText}
            </div>
			<MomentNumber theNumber = {props.momentNumber}/>
			{controlZoneGuts}
        </div>
    );
}

function MomentNumber(props: any) {
	return(
		<div className={"moment-number"}>{props.theNumber}</div>
	)
}

function NewMomentButton(props:any) {
	return(
		<div
			className="moment-button new-moment-button"
			onClick={props.onNewMoment}
			title={"Make a new moment"}
		>+</div>
	)
}

function SaveButton(props:any) {
	return(
		<div
			className="moment-button save-moment-button"
			onClick={props.onSaveMoment}
			title={"Save this moment"}
		>√</div>
	)
}

function DeleteButton(props:any) {
	return(
		<div
			className="moment-button delete-button"
			onClick={props.onDelete}
			title={"Delete this moment"}
		>X</div>
	)
}

function RevertButton(props:any) {
	return(
		<div
			className="moment-button revert-button"
			onClick={props.onDelete}
			title={"Revert! Discard all changes!"}
		>R</div>
	)
}

