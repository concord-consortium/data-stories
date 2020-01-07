import React, {Component} from "react";

interface IStringKeyedObject {
    [key: string]: string;
}

export class Moment {

    public ID: number = -1;     //  todo: do we need this at all?
    public prev: number = -1;
    public next: number = -1;
    public codapStateDiff: [number, object][] = [];

    public isMarker: boolean = false;
    public title: string = "";
    public created: Date = new Date();
    public narrative: string = "";

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

    constructor(iCommand: any) {
        const theNewMomentTitle = (iCommand.values) ?
            this.parseCommand(iCommand).title :
            iCommand;

        this.setTitle(theNewMomentTitle);
    }

    parseCommand(iCommand: any): any {
        let out = {
            title: "",
        };

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

        let theNewMomentTitle = '',
            numCases = 0;

        iCommand.values.type = this.componentMap[iCommand.values.type] || iCommand.values.type;
        switch (iCommand.values.operation) {
            case 'createCases':
                numCases = iCommand.values.result.caseIDs.length;
                theNewMomentTitle = 'create ' + numCases + (numCases > 1 ? ' cases' : ' case');
                break;
            case 'create':
                theNewMomentTitle = 'create ' + formComponentMessage();
                break;
            case 'delete':
                theNewMomentTitle = 'delete ' + formComponentMessage();
                break;
            case 'beginMoveOrResize':
                break;
            case 'move':
            case 'resize':
                theNewMomentTitle = iCommand.values.operation + ' ' + formComponentMessage();
                break;
            case 'selectCases':
                if (iCommand.values.result.cases) {
                    numCases = iCommand.values.result.cases.length;
                    theNewMomentTitle = 'select ' + numCases + ' case' + (numCases > 1 ? 's' : '');
                }
                break;
            case 'hideSelected':
                theNewMomentTitle = 'hide selected cases';
                break;
            case 'attributeChange':
                theNewMomentTitle = 'plot attribute "' + iCommand.values.attributeName + '" on graph';
                break;
            case 'legendAttributeChange':
                theNewMomentTitle = 'plot attribute "' + iCommand.values.attributeName + '" on graph legend';
                break;
            case 'edit':
                theNewMomentTitle = 'edit ' + iCommand.values.title;
                break;
            default:
                if (iCommand.values.globalValue) {
                    theNewMomentTitle = "change slider";
                } else {
                    theNewMomentTitle = iCommand.values.operation;
                }
        }
        out.title = theNewMomentTitle;
        return out;
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