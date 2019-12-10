import jiff from "jiff";
import {StoryEventModel} from "./story-event";


export class StoryEventSet {
    private storyEvents: StoryEventModel[] = [];
    private notificationInWaiting: object | null = null;
    private currentIndex: number = -1;
    private startingIndex: number = -1;
    private focusIndex: number = -1;
    private parent: any;

    public initialCodapState: object | null = null;
    public currentCodapState: object | null = null;

    constructor(iParent: any) {
        this.initializeToCodapState(null);
        this.parent = iParent;
    }

    initializeToCodapState(iState: object | null) {
        this.initialCodapState = iState;
        this.setInitialStoryEvent();
    }

    getCurrentIndex() {
        return this.currentIndex
    }

    setCurrentIndex(i: number) {
        if (i < 0) i = 0;
        this.currentIndex = i;
        console.log("Current index now " + i);
    }

    setFocusIndex(i: number) {
        this.focusIndex = i;
    }

    setStartingIndex(i: number) {
        if (i < 0) i = 0;
        this.startingIndex = i;
    }

    /**
     * Blank the array of storyEvents,
     * and create a new initial event, called "start"
     */
    setInitialStoryEvent() {
        this.storyEvents = [];
        this.currentIndex = -1;
        let tEvent: StoryEventModel = this.addNewStoryEvent("start");
        this.startingIndex = tEvent.ID;
        this.focusIndex = tEvent.ID;
        tEvent.setMarker(true);
    }


    checkForCollapse(now: StoryEventModel | undefined, next: StoryEventModel): boolean {
        if (now === undefined || now.prev < 0) return false;
        const dt = next.created.getTime() - now.created.getTime();  //  in milliseconds

        return (dt < 100);
    }

    length() {
        return this.storyEvents.length;
    }

    /**
     * Return the StoryEvent model corresponding to the given ID.
     * @param iID
     */
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

    /**
     * Starting at the `startingINdex`, traverse the list and assemble an array
     * of StoryEvents on the current timeline.
     */
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

    /**
     * Do necessary computations for a new CODAP state:
     * If we have none, install it as the initial state
     * Return after that depending on flags in the parent
     * Then compute (using jiff) the difference between the "old" state and this one;
     * Finally, install this one as the official state.
     *
     * @param newCodapState   the new CODAP state (an object)
     */
    makeAndStoreNewStoryEvent(newCodapState: object): void {
        const oldEvent = this.currentStoryEvent();
        const oldCodapState = this.currentCodapState;

        const newEvent = this.addNewStoryEvent(this.notificationInWaiting); //   this.currentStoryEvent();
        if (newEvent) newEvent.codapStateDiff = jiff.diff(oldCodapState, newCodapState);
        this.notificationInWaiting = null;

        this.currentCodapState = newCodapState;
    }

    /**
     * Add a StoryEvent to our list, making appropriate adjustments to .next and .prev members.
     * Note that this just adds the event; it does not (yet) have its codapStateDiff set.
     * @param iCommand
     */
    addNewStoryEvent(iCommand: any): StoryEventModel {
        let tNextEvent: StoryEventModel = new StoryEventModel(iCommand);
        let tCurrentEvent: StoryEventModel | undefined = this.currentStoryEvent();

        const tCollapse = this.checkForCollapse(tCurrentEvent, tNextEvent);
        if (tCollapse) console.log("     •••••");

        const newEventIndex = this.storyEvents.length;  //  length BEFORE the push
        tNextEvent.ID = newEventIndex;              //      needed?
        tNextEvent.prev = this.currentIndex;        //  links back to "latest" event, -1 if there is none

        //  set the "current" (soon to be prev) event's "next" to point to the new index
        if (this.currentIndex >= 0) {
            this.storyEvents[this.currentIndex].next = newEventIndex;  //  link the old one to this one
        }
        this.storyEvents.push(tNextEvent);
        this.setCurrentIndex(newEventIndex);

        return tNextEvent;
    }

    /**
     * Called from above; we get asked for a state based on an event and its predecessors
     * @param iID
     */
    constructStateToTravelTo(iID: number): object | null {
        const tState = this.getStateByStoryEventID(iID);
        return tState;
    }

    /**
     * Start at the initialState and apply the differences until you get to the given event ID.
     * The result should be the CODAP state at that moment (after the event occurred).
     * @param iID
     */
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
        let dIndexArray = [];

        let tStoryEvent: StoryEventModel | undefined = this.storyEventByStoryEventID(iID);   //  does the event even exist?

        if (tStoryEvent) {
            tCodapState = this.initialCodapState;
            let tIndex = this.startingIndex,
                tDone = false;
            while (!tDone && tIndex >= 0) {     //  because xxx.next = -1 if we're at the end
                dIndexArray.push(tIndex);

                const aStoryEvent = this.storyEvents[tIndex];
                if (testPatch(aStoryEvent.codapStateDiff, tCodapState)) {
                    tCodapState = jiff.patch(aStoryEvent.codapStateDiff, tCodapState);
                }
                tDone = aStoryEvent.ID === iID;
                tIndex = aStoryEvent.next;
            }
        }
        console.log("Constructed state: \n\t[" + dIndexArray.join(" ") + "]\n\t" + this.stateInfoString(tCodapState));
        return tCodapState;     //  null if there is no storyEvent corresponding to iID
    }

    handleNotification(iCommand: any): any {

        /**
         * This is a kludge.  todo: eliminate the kludge
         */
        let handlerResult: any = {
            waiting: false,
            doSetState: false,
        };

        /*
            The idea is this: When the user does something undoable (e.g., create slider)
            the first notification is for that creation; at that point we store that
            notification in `this.notificationInWaiting`.
            LATER, CODAP has figured out the new state of the document, and issues a newDocumentState notification,
            at which point we (a) create a new StoryEvent and insert into the this.storyEvents list, and
            (b) compute the difference from the previous document state and insert it (storeCodapState())
            in the StoryEvent that we just created in its codapStateDiff field.
           */

        if (iCommand.resource !== 'undoChangeNotice') {
            if (iCommand.values.operation === 'newDocumentState') { //  this happens second
                const tNewCodapState = iCommand.values.state;
                if (!this.initialCodapState) {
                    this.initialCodapState = tNewCodapState;
                } else if (this.parent.restoreInProgress) return;

                else if (this.notificationInWaiting) {
                    this.makeAndStoreNewStoryEvent(tNewCodapState);
                    this.notificationInWaiting = null;
                    console.log("    new event yields state: " + this.stateInfoString(tNewCodapState));
                } else {
                    console.log("    travel to state: " + this.stateInfoString(tNewCodapState));

                    //  this happens on the newDocumentState notification that comes
                    //  after the user presses a storyEvent control to time-travel
                }
                this.currentCodapState = tNewCodapState;
                handlerResult.doSetState = true;
            } else {            //  this happens first
                if (this.notificationInWaiting) {
                    alert("unexpected notification!");
                } else {
                    this.notificationInWaiting = iCommand;  //  save this for later
                }
            }
        }

        return handlerResult;
    }

    stateInfoString(iState:any) {
        const theComponents: any = iState["components"];
        const compArray = theComponents.map( (el:any) => el.type);
        return compArray.join(" ");
    }
}
