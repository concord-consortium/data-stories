import React, {Component} from "react";

export class StoryEventModel {

    public ID: number = -1;     //  todo: do we need this at all?
    public prev: number = -1;
    public next: number = -1;
    public codapStateDiff: [number, object][] = [];

    public isMarker: boolean = false;
    public title: string = "";
    public created: Date = new Date();
    public narrative: string = "";

    constructor() {

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

export function StoryEvent(props: any) {
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