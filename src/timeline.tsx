import jiff from "jiff";
import {Moment} from "./moment";


export class Timeline {
    private moments: Moment[] = [];
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
        this.setInitialMoment();
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
     * Blank the array of moments,
     * and create a new initial Moment, called "start"
     */
    setInitialMoment() {
        this.moments = [];
        this.currentIndex = -1;
        let tMoment: Moment = this.addNewMoment("start");
        this.startingIndex = tMoment.ID;
        this.focusIndex = tMoment.ID;
        tMoment.setMarker(true);
    }


    checkForCollapse(now: Moment | undefined, next: Moment): boolean {
        if (now === undefined || now.prev < 0) return false;
        const dt = next.created.getTime() - now.created.getTime();  //  in milliseconds

        return (dt < 100);
    }

    length() {
        return this.moments.length;
    }

    /**
     * Return the Moment model corresponding to the given ID.
     * @param iID
     */
    momentByID(iID: number): Moment | undefined {
        return this.moments.find(function (xSE) {
            return xSE.ID === iID
        });
    }

    focusMoment() {
        return this.momentByID(this.focusIndex);
    }

    currentMoment() {
        return this.momentByID(this.currentIndex);
    }

    /**
     * Starting at the `startingIndex`, traverse the list and assemble an array
     * of StoryMoments on the current timeline.
     */
    momentsOnThisTimeline() {
        let out = [];
        let xSE = this.startingIndex;
        while (xSE >= 0) {
            const nextMoment = this.moments[xSE];
            out.push(nextMoment);
            xSE = nextMoment.next;
        }
        return out;
    }


    /**
     * Called from above; we get asked for a state based on a moment and its predecessors
     * @param iID
     */
    constructStateToTravelTo(iID: number): object | null {
        return this.getStateByMomentID(iID);
    }

    /**
     * Start at the initialState and apply the differences until you get to the given moment ID.
     * The result should be the CODAP state at that moment (after the notification occurred).
     * @param iID
     */
    getStateByMomentID(iID: number): object | null {
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

        let tMoment: Moment | undefined = this.momentByID(iID);   //  does the moment even exist?

        if (tMoment) {
            tCodapState = this.initialCodapState;
            let tIndex = this.startingIndex,
                tDone = false;
            while (!tDone && tIndex >= 0) {     //  because xxx.next = -1 if we're at the end
                dIndexArray.push(tIndex);

                const aMoment = this.moments[tIndex];
                if (testPatch(aMoment.codapStateDiff, tCodapState)) {
                    tCodapState = jiff.patch(aMoment.codapStateDiff, tCodapState);
                }
                tDone = aMoment.ID === iID;
                tIndex = aMoment.next;
            }
        }
        console.log("Constructed state: \n\t[" + dIndexArray.join(" ") + "]\n\t" + this.stateInfoString(tCodapState));
        return tCodapState;     //  null if there is no storyMoment corresponding to iID
    }

    public doCombineMoments(): void {

        const momentAndStateParams:any = this.prepareToCombineMoments();
        if (momentAndStateParams.OK) {
            const theCombinedMoment : any = this.combineCurrentMomentWithPrevious(momentAndStateParams);
            
            //  now replace the last two moments with this new one...
            this.currentIndex = theCombinedMoment.prevMoment.ID;

            theCombinedMoment.prevMoment.next = theCombinedMoment.latestMoment.next;
            if (theCombinedMoment.latestMoment.next >= 0) {
                let theNextMoment = this.momentByID(theCombinedMoment.latestMoment.next);
                if (theNextMoment) {
                    theNextMoment.prev = theCombinedMoment.prevMoment.ID;
                }
            }

            //  more here! especially, need to actually put  the new moment into the list
            //  and where is that moment, anyway?!
        }
    }

    private prepareToCombineMoments(): object {
        let out : object = {OK : false};

        const stateNow = this.currentCodapState;
        const latestMoment = this.currentMoment();
        if (latestMoment) {
            const prevIndex = (latestMoment as Moment).prev;
            const prevMoment = this.momentByID(prevIndex);     //  undefined if it doesn't exist
            if (prevMoment) {
                const stateBefore = (prevIndex === this.startingIndex) ?
                    this.initialCodapState :
                    this.getStateByMomentID(prevMoment.prev);
                out = {
                    stateNow : stateNow,
                    stateBefore : stateBefore,
                    latestMoment : latestMoment,
                    prevMoment : prevMoment,
                    OK : true
                }
            }
        }
        return out;
    }

    private combineCurrentMomentWithPrevious(iMomentParams:any):Moment | undefined {
        let newTitle = "mixed moment";
        let oMoment;
                const diffInStateForBothMoments = jiff.diff(iMomentParams.stateBefore, iMomentParams.stateNow);
                const syntheticNotification = {
                    "title": newTitle
                };
                oMoment = new Moment(syntheticNotification);
                oMoment.codapStateDiff = diffInStateForBothMoments;
            return oMoment;
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
    makeAndStoreNewMoment(newCodapState: object): void {
        const oldMoment = this.currentMoment();
        const oldCodapState = this.currentCodapState;

        const newMoment = this.addNewMoment(this.notificationInWaiting);
        if (newMoment) newMoment.codapStateDiff = jiff.diff(oldCodapState, newCodapState);
        this.notificationInWaiting = null;

        this.currentCodapState = newCodapState;
    }

    /**
     * Add a Moment to our list, making appropriate adjustments to .next and .prev members.
     * Note that this just adds the Moment; it does not (yet) have its codapStateDiff set.
     * @param iCommand
     */
    addNewMoment(iCommand: any): Moment {
        let tNextMoment: Moment = new Moment(iCommand);
        let tCurrentMoment: Moment | undefined = this.currentMoment();

        const tCollapse = this.checkForCollapse(tCurrentMoment, tNextMoment);
        if (tCollapse) console.log("     •••••");

        const newMomentIndex = this.moments.length;  //  length BEFORE the push
        tNextMoment.ID = newMomentIndex;              //      needed?
        tNextMoment.prev = this.currentIndex;        //  links back to "latest" Moment, -1 if there is none

        //  set the "current" (soon to be prev) moment's "next" to point to the new index
        if (this.currentIndex >= 0) {
            this.moments[this.currentIndex].next = newMomentIndex;  //  link the old one to this one
        }
        this.moments.push(tNextMoment);
        this.setCurrentIndex(newMomentIndex);

        return tNextMoment;
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
            at which point we (a) create a new Moment and insert into the this.moments list, and
            (b) compute the difference from the previous document state and insert it (storeCodapState())
            in the Moment that we just created in its codapStateDiff field.
           */

        if (iCommand.resource !== 'undoChangeNotice') {
            if (iCommand.values.operation === 'newDocumentState') { //  this happens second
                const tNewCodapState = iCommand.values.state;
                if (!this.initialCodapState) {
                    this.initialCodapState = tNewCodapState;
                } else if (this.parent.restoreInProgress) return;

                else if (this.notificationInWaiting) {
                    this.makeAndStoreNewMoment(tNewCodapState);
                    this.notificationInWaiting = null;
                    console.log("    new moment yields state: " + this.stateInfoString(tNewCodapState));
                } else {
                    console.log("    travel to state: " + this.stateInfoString(tNewCodapState));

                    //  this happens on the newDocumentState notification that comes
                    //  after the user presses a Moment control to time-travel
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
