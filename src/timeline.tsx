//  import jiff from "jiff";
import {Moment} from "./moment";


export class Timeline {
    private moments: Moment[] = [];
//    private notificationInWaiting: object | null = null;
    private currentIndex: number = -1;
    private startingIndex: number = -1;
    private nextMomentID = 0;
    private parent: any;

    public initialCodapState: object | null = null;
    public currentCodapState: object | null = null;

    constructor(iParent: any) {
        //  this.initializeToCodapState(null);
        this.parent = iParent;
    }

    getCurrentIndex() {
        return this.currentIndex
    }

    setCurrentIndex(i: number) {
        if (i < 0) i = 0;
        this.currentIndex = i;
        console.log("Current index now " + i);
    }

    setStartingIndex(i: number) {
        if (i < 0) i = 0;
        this.startingIndex = i;
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
            this.setCurrentIndex(iID);
            this.currentCodapState = tMoment.codapState;

            return tMoment;
        }
        return null;
    }

    deleteCurrentMarker() : void {
        //  todo: check to see if it's OK to delete. Is it OK to delete the last marker? The first marker?
        const theIndex = this.currentIndex;
        this.moments.splice(theIndex, 1);
        if (this.currentIndex >= this.moments.length) {
            this.setCurrentIndex(this.moments.length - 1);
        }
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

    currentMoment() {
        return this.momentByID(this.currentIndex);
    }

    /**
     * Starting at the `startingIndex`, traverse the list and assemble an array
     * of StoryMoments on the current timeline.
     */
    momentsOnThisTimeline() {
/*
        let out = [];
        let xSE = this.startingIndex;
        while (xSE >= 0) {
            const nextMoment = this.moments[xSE];
            out.push(nextMoment);
            xSE = nextMoment.next;
        }
*/
        //  return out;

        return this.moments;
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
        this.nextMomentID += 1;

        this.moments.push(tNewMoment);
        this.setCurrentIndex(tNewMoment.ID);
        this.setStartingIndex(tNewMoment.ID);
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


    handleNotification(iCommand: any): void {

    }

    /**
     * Used for debugging. Shows the types of components in the given State
     * @param iState
     */
    stateInfoString(iState: any) {
        const theComponents: any = iState["components"];
        const compArray = theComponents.map((el: any) => el.type);
        return compArray.join(" ");
    }
}
