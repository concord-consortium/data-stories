//  import jiff from "jiff";
import {Moment} from "./moment";
import React, {Component} from 'react';


export class Timeline {
    private moments: Moment[] = [];
//    private notificationInWaiting: object | null = null;
    public currentMoment: Moment | null = null;
    private startingMoment: Moment | null = null;
    private parent: any;
    public initialCodapState: object | null = null;
    private nextMomentID: number = 0;
    private momentBeingDragged: Moment | null = null;

    /*
        public currentCodapState: object | null = null;
    */

    constructor(iParent: any) {
        //  this.initializeToCodapState(null);
        this.parent = iParent;
    }

    /*
        isMoment(m: Moment | undefined): m is Moment {
            return (m as Moment).codapState !== undefined;
        }
    */


    length() {
        //  todo: traverse the list to find the effective length.
        return this.moments.length;
    }

    /**
     * Return the (entire) Moment model corresponding to the given ID.
     * @param iID
     */
/*
    momentByID(iID: number): Moment {
        return this.moments.find(function (xSE) {
            return xSE.ID === iID
        }) as Moment;
    }
*/

    /**
     * Called from above. User has clicked on a particular moment, so we are about to time travel there.
     * Adjust this timeline (model) so that everything is set correctly.
     * @param iMoment   the moment being clicked on
     */
    handleMomentClick(iMoment: Moment | null ): Moment | null {
        this.currentMoment = iMoment;
        /*

                if (this.isMoment(iMoment)) {
                    return iMoment;
                }
                return null;
        */
        return iMoment;
    }

    handleDragStart(e: React.DragEvent, iMoment: Moment) {
        this.momentBeingDragged = iMoment;
    }

    handleDrop(x: number) : Moment | null {
        let pMoment: Moment | null = null;

        if (this.momentBeingDragged) {
            console.log("Dropping [" + this.momentBeingDragged.title + "] ");
            pMoment = this.startingMoment;
            let done: boolean = false;

            if (pMoment) {
                let momentWereLookingAt : Moment = pMoment;

                while (!done) {
                    const theElement: any = document.getElementById("DSMarker" + momentWereLookingAt.ID);
                    const momentRect: DOMRect = theElement.getBoundingClientRect();
                    const momentCenter = momentRect.left + momentRect.width / 2;

                    if (x < momentCenter) {
                        done = true;
                        pMoment = momentWereLookingAt.prev;
                    } else if (x < momentRect.right) {
                        pMoment = momentWereLookingAt;
                        done = true;
                    }

                    if (momentWereLookingAt.next) {
                        momentWereLookingAt = momentWereLookingAt.next;
                    } else {
                        pMoment = momentWereLookingAt;
                        done = true;
                    }
                }
            }
            /*
                            while (slot > pIndex && pMoment) {
                                if (pMoment.next) pMoment = pMoment.next;   //  peg at last moment in list
                                pIndex++;
                            }
            */

            if (this.momentBeingDragged !== pMoment) {
                this.removeMoment(this.momentBeingDragged);
                this.insertMomentAfterMoment(this.momentBeingDragged, pMoment);
            }
        }
        const returnValue : Moment | null = this.momentBeingDragged;
        this.momentBeingDragged = null;
        return returnValue;
    }

    /**
     * Remove the given moment from the prev-next stream in the moments array
     * Note: this does not remove the moment from the array;
     * it just adjusts the prev and next of its neighbors.
     *
     * If the argument is null, nothing happens.
     *
     * @param iMoment
     */
    removeMoment(iMoment: Moment | null) {
        if (iMoment) {
            const theDoomedMoment: Moment = iMoment;
            const predecessor = theDoomedMoment.prev;
            const successor = theDoomedMoment.next;

            if (predecessor) {
                predecessor.next = successor;    //  correct if doomed is last in line
                this.currentMoment = predecessor;
            } else {    //  no predecessor; the doomed one is the first
                this.startingMoment = successor;   //  will be null if the list is now empty
                this.currentMoment = successor; // do the next one if we killed off the first
            }

            if (successor) {
                successor.prev = predecessor;
            }

            theDoomedMoment.next = null;
            theDoomedMoment.prev = null;
        }
    }

    removeCurrentMoment(): void {
        this.removeMoment(this.currentMoment);
        //  todo: consider actually removing the moment from the array (for space). Use splice()
    }


    /**
     * Alter the moments list, inserting the given moment after the given moment
     * (if it's going to the beginning, the given moment will be null)
     * Note that this moment is already in the timeline.moments array.
     * That happened when the moment was created.
     * we are only adjusting its prev and next fields.
     *
     * @param moment    moment to insert
     * @param previousMoment  moment after which to insert it.
     */
    insertMomentAfterMoment(moment: Moment, previousMoment: Moment | null) {
        let subsequentMoment;

        if (previousMoment) {
            subsequentMoment = previousMoment.next;
            moment.prev = previousMoment;
            moment.next = subsequentMoment; //  null if at the end
            previousMoment.next = moment;
        } else {
            //   there are no moments in the list, e.g., at initialization
            //  or we're moving this moment to the beginning of the list, so
            //  previousMoment is null.
            moment.next = this.startingMoment;  //  which is null if the list is empty
            this.startingMoment = moment;
            moment.prev = null;
            subsequentMoment = moment.next;
        }
        if (subsequentMoment) {
            subsequentMoment.prev = moment;
        }

        this.currentMoment = moment;
    }

    /**
     * Starting at the `startingID`, traverse the list and assemble an array
     * of Moments in the current order.
     */

    momentsOnThisTimeline() {
        let out = [];
        let xMoment = this.startingMoment;
        while (xMoment) {
            out.push(xMoment);
            xMoment = xMoment.next;
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
        tNewMoment.ID = this.nextMomentID;    //  will be zero if this is new.
        this.nextMomentID += 1;     // the global number of IDs we have. Not moments.length in case of deletions.

        this.moments.push(tNewMoment);
        //  now, in the linked list, insert after the current ID.
        this.insertMomentAfterMoment(tNewMoment, this.currentMoment);
        this.currentMoment = tNewMoment;
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
    setNewNarrative(iString: string): void {
        let theMoment = this.currentMoment;
        if (theMoment) theMoment.setNarrative(iString);
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
