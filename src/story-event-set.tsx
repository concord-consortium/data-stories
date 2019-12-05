import jiff from "jiff";
import {StoryEventModel} from "./story-event";


export class StoryEventSet {
    private storyEvents: StoryEventModel[] = [];
    private currentIndex:number = -1;
    private startingIndex:number = -1;
    private focusIndex: number = -1;
    private parent: any;

    public initialCodapState: object | null = null;

    constructor(iParent : any) {
        this.initializeToCodapState(null);
        this.parent = iParent;
    }

    initializeToCodapState( iState: object | null) {
        this.initialCodapState = iState;
        this.storyEvents = [];
        this.currentIndex = -1;
        this.startingIndex = -1;
        this.focusIndex = -1;
        this.setInitialStoryEvent();
    }

    setCurrentIndex( i:number) {
        if (i < 0) i = 0;
        this.currentIndex = i;
    }

    setFocusIndex(i:number) {
        this.focusIndex = i;
    }

    setStartingIndex( i:number) {
        if (i < 0) i = 0;
        this.startingIndex = i;
    }

    setInitialStoryEvent( ) {
        this.storyEvents = [];
        this.currentIndex = -1;
        let tEvent: StoryEventModel = this.addNewStoryEvent("start");
        this.startingIndex = tEvent.ID;
        this.focusIndex = tEvent.ID;
        tEvent.setMarker(true);
    }

    addNewStoryEvent( iTitle: string):StoryEventModel {
        let tEvent: StoryEventModel = new StoryEventModel();
        tEvent.setTitle(iTitle);
        const newEventIndex = this.storyEvents.length;
        tEvent.ID = newEventIndex;    //      needed?
        tEvent.prev = this.currentIndex;        //  links back to "latest" event, -1 if there is none

        if (this.currentIndex >= 0) {
            this.storyEvents[this.currentIndex].next = newEventIndex;  //  link the old one to this one
        }
        this.storyEvents.push(tEvent);
        this.currentIndex = newEventIndex;

        return tEvent;
    }

    length() {
        return this.storyEvents.length;
    }

    storyEventByStoryEventID(iID: number): StoryEventModel | undefined {
        return this.storyEvents.find(function (xSE) {
            return xSE.ID === iID
        });
    }

    focusStoryEvent() {
        return this.storyEventByStoryEventID(this.focusIndex);
    }

    currentStoryEvent() {
        return this.storyEventByStoryEventID(this.currentIndex);
    }

    storyEventsOnThisTimeline() {
        let out = [];
        let xSE = this.startingIndex;
        while (xSE >= 0) {
            const nextEvent = this.storyEvents[xSE];
            out.push(nextEvent);
            xSE = nextEvent.next;
        }
        return out;
    }

    getStateByStoryEventID(iID: number): object | null {
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

        let tCodapState = null;

        let tStoryEvent = this.storyEventByStoryEventID(iID);

        if (tStoryEvent) {
            tCodapState = this.initialCodapState;
            let tIndex = this.startingIndex,
                tDone = false;
            while (!tDone && tIndex >= 0) {     //  because xxx.next = -1 if we're at the end
                const tCurrentStoryEvent = this.storyEvents[tIndex];
                if (testPatch(tCurrentStoryEvent.codapStateDiff, tCodapState)) {
                    tCodapState = jiff.patch(tCurrentStoryEvent.codapStateDiff, tCodapState);
                }
                tDone = tCurrentStoryEvent.ID === iID;
                tIndex = tCurrentStoryEvent.next;
            }
        }
        return tCodapState;     //  null if there is no storyEvent corresponding to iID
    }
}
