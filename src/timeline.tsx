//  import jiff from "jiff";
import {Moment} from "./moment";


export class Timeline {
    private moments: Moment[] = [];
//    private notificationInWaiting: object | null = null;
    private currentID: number = -1;
    private startingID: number = -1;
    private nextMomentID = 0;       //   will be the ID of the first moment
    private parent: any;

    public initialCodapState: object | null = null;
    public currentCodapState: object | null = null;

    constructor(iParent: any) {
        //  this.initializeToCodapState(null);
        this.parent = iParent;
    }

    getCurrentID() {
        return this.currentID;
    }

    setCurrentID(i: number) {
        //  if (i < 0) i = this.startingID;
        this.currentID = i;
        console.log("Current index now " + i);
    }

    setStartingID(i: number) {
        //  if (i < 0) this.currentID = -1;
        this.startingID = i;
    }

    isMoment(m : Moment | undefined): m is Moment {
        return( m as Moment).codapState !== undefined;
    }

    /**
     * Called from above. User has clicked on a particular moment, so we are about to time travel there.
     * Adjust this timeline (model) so that everything is set correctly.
     * @param iID
     */
    onMomentClick(iID: number): Moment | null {
        const tMoment = this.momentByID(iID);

        if (this.isMoment(tMoment)) {
            this.setCurrentID(iID);
            this.currentCodapState = tMoment.codapState;

            return tMoment;
        }
        return null;
    }

    deleteMomentByID( iID : number) {
        const theDoomedMoment : Moment = this.momentByID(iID);
        const predecessor = this.momentByID(theDoomedMoment.prev);
        if (predecessor) {
            predecessor.next = theDoomedMoment.next;    //  correct if doomed is last in line
            this.setCurrentID(predecessor.ID);
        } else {    //  no predecessor; the doomed one is the first
            this.setStartingID(theDoomedMoment.next);   //  will be -1 if the list is now empty
            this.setCurrentID(theDoomedMoment.next);
        }
    }

    deleteCurrentMoment() : void {
        const theID = this.currentID;
        this.deleteMomentByID(theID);
        //  todo: consider actually removing the moment from the array (for space). Use splice()
    }

    length() {
        return this.moments.length;
    }

    /**
     * Return the (entire) Moment model corresponding to the given ID.
     * @param iID
     */
    momentByID(iID: number): Moment {
        return this.moments.find(function (xSE) {
            return xSE.ID === iID
        }) as Moment;
    }

    currentMoment() {
        return this.momentByID(this.currentID);
    }

    /**
     * Alter the moments list, inserting the given moment after the moment
     * of the given ID.
     * Note that this moment is already in the timeline.moments array.
     * That happened when the moment was created.
     * we are only adjusting its prev and next fields.
     *
     * @param moment    moment to insert
     * @param previousMomentID  ID after which to insert it.
     */
    insertMomentAfterID(moment : Moment, previousMomentID : number) {
        const previousMoment = this.momentByID(previousMomentID);
        if (previousMoment) {
            const subsequentMomentID = previousMoment.next;
            moment.prev = previousMomentID;
            moment.next = previousMoment.next;
            previousMoment.next = moment.ID;

            const afterMoment: Moment = this.momentByID(subsequentMomentID);
            if (afterMoment) {
                afterMoment.prev = moment.ID;
            }
        } else {   //   there are no moments in the list, e.g., at initialization
            this.setStartingID(moment.ID);
            moment.prev = -1;
            moment.next = -1;
        }
    }

    /**
     * Starting at the `startingID`, traverse the list and assemble an array
     * of Moments in the current order.
     */

    momentsOnThisTimeline() {
        let out = [];
        let xMomentID = this.startingID;
        while (xMomentID >= 0) {
            const nextMoment:Moment | undefined = this.momentByID(xMomentID);
            if (nextMoment) {
                out.push(nextMoment);
                xMomentID = nextMoment.next;
            }
        }
        return out;
    }

    /**
     * Create a marker, given a current CODAP state.
     * return a Moment based on that state.
     *
     * @param iCodapState
     */
    makeMarkerOnDemand(iCodapState: any): Moment {
        if (!this.initialCodapState) {
            this.moments = [];      //  blank the moment array
            this.initialCodapState = iCodapState;
        }

        let tNewMoment: Moment = new Moment(iCodapState);
        this.currentCodapState = iCodapState;
        tNewMoment.ID = this.nextMomentID;    //  will be zero if this is new.
        this.nextMomentID += 1;     // the global number of IDs we have. Not moments.length in case of deletions.

        this.moments.push(tNewMoment);
        //  now, in the linked list, insert after the current ID.
        this.insertMomentAfterID(tNewMoment, this.currentID);
        this.setCurrentID(tNewMoment.ID);
        tNewMoment.setMarker(true);

        tNewMoment.title = (tNewMoment.ID === 0) ? "start\ncomienzo" : "Moment " + tNewMoment.ID;
        tNewMoment.narrative = "What did you do? Why did you do it?\n¿Qué hizo? ¿Por qué?";
        return tNewMoment;
    }

    /**
     * Set the narrative for the current index to the given text
     * which was captured by the plugin from the text object, in response
     * to an edit event.
     *
     * @param iString
     */
    setNewNarrative(iString : string) : void {
        let theMoment  = this.currentMoment();
        if (theMoment) theMoment.narrative = iString;
    }


/*
    handleNotification(iCommand: any): void {

    }
*/

    /**
     * Used for debugging. Shows the types of components in the given State
     * @param iState
     */
/*
    stateInfoString(iState: any) {
        const theComponents: any = iState["components"];
        const compArray = theComponents.map((el: any) => el.type);
        return compArray.join(" ");
    }
*/
}
