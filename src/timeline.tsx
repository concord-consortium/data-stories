import jiff from "jiff";
import {Moment} from "./moment";


export class Timeline {
    private moments: Moment[] = [];
    private notificationInWaiting: object | null = null;
    private currentIndex: number = -1;
    private startingIndex: number = -1;
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

    /**
     * Called from above. User has clicked on a particular moment, so we are about to time travel there.
     * Adjust this timeline (model) so that everything is set correctly.
     * @param iID
     */
    onMomentClick(iID: number): Moment {
        const tMoment = this.moments[iID];
        this.setCurrentIndex(iID);
        this.currentCodapState = tMoment.codapState;

        return tMoment;
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

    makeMarkerOnDemand(iCodapState: any): Moment {
        let theTitle: string = "";
        if (!this.initialCodapState) {
            this.moments = [];      //  blank the moment array
            this.initialCodapState = iCodapState;
        }

        let tNewMoment: Moment = new Moment(iCodapState);
        this.currentCodapState = iCodapState;
        tNewMoment.ID = this.moments.length;    //  will be zero if this is new.

        this.moments.push(tNewMoment);
        this.setCurrentIndex(tNewMoment.ID);
        this.setStartingIndex(tNewMoment.ID);
        tNewMoment.setMarker(true);

        tNewMoment.title = (tNewMoment.ID === 0) ? "start" : "M " + tNewMoment.ID;
        return tNewMoment;
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
        This method maintains this.currentCodapState.
        We get sent the new state with a newDocumentState notification.

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
                    //  this.makeAndStoreNewMoment(tNewCodapState);
                    this.notificationInWaiting = null;
                    //  console.log("    new moment yields state: " + this.stateInfoString(tNewCodapState));
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
                    //  this.notificationInWaiting = iCommand;  //  save this for later
                }
            }
        }

        return handlerResult;
    }

    stateInfoString(iState: any) {
        const theComponents: any = iState["components"];
        const compArray = theComponents.map((el: any) => el.type);
        return compArray.join(" ");
    }
}
