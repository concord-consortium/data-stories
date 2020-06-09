//  import jiff from "jiff";
import {Moment} from "./moment";
import React, {Component} from 'react';


export class Timeline {
    private moments: Moment[] = [];
    public currentMoment: Moment | null = null;
    public dstMoment: Moment = new Moment(null);
    public srcMoment: Moment = new Moment(null);
    public startingMoment: Moment | null = null;
    private parent: any;
    //	public initialCodapState: object | null = null;
    private nextMomentID: number = 0;
    private momentBeingDragged: Moment | null = null;

    private kInitialJSONText = "{\"object\":\"value\",\"document\":{\"children\":[{\"type\":\"paragraph\",\"children\":[{\"text\":\"What did you do? Why did you do it?\"}]},{\"type\":\"paragraph\",\"children\":[{\"text\":\"¿Qué hizo? ¿Por qué?\"}]}],\"objTypes\":{\"paragraph\":\"block\"}}}";
    private kInitialJSONText_start = "{\"object\":\"value\",\"document\":{\"children\":[{\"type\":\"paragraph\",\"children\":[{\"text\":\"This is the beginning of your data story.\"}]},{\"type\":\"paragraph\",\"children\":[{\"text\":\"Esto es el comienzo de su cuento de datos.\"}]}],\"objTypes\":{\"paragraph\":\"block\"}}}";

    private kDefaultNarrative: string = `What did you do? Why did you do it? ... ¿Qué hizo? ¿Por qué?`;


    constructor(iParent: any) {
        //  this.initializeToCodapState(null);
        this.parent = iParent;
        this.moments = [];
    }


    getCurrentMomentTitle(): string {
        return (this.currentMoment) ? this.currentMoment.title : "";
    }

    createStorage() {
        let tMomentArray: {}[] = [],
            tMoment = this.startingMoment,
            tIndex = 0,
            tCurrMomentIndex: Number = 0;
        while (tMoment) {

            if (tMoment === this.currentMoment)
                tCurrMomentIndex = tIndex;

            tMomentArray.push(tMoment.createStorage());
            tMoment = tMoment.next;
            tIndex++;
        }

        return {
            moments: tMomentArray,
            nextMomentID : this.nextMomentID,
            currentMomentIndex : tCurrMomentIndex,
        }
    }

    restoreFromStorage(iStorage: any) {
        let this_ = this,
            tCurrMoment: Moment | null = null;
        this.startingMoment = null;
        this.currentMoment = null;
        if (iStorage) {
            this.nextMomentID = iStorage.nextMomentID;
        }

        if (!(iStorage && iStorage.moments))
            return;
        iStorage.moments.forEach((iMomentStorage: any, iIndex: Number) => {
            let tMoment = new Moment(iMomentStorage.codapState);
            tMoment.restoreFromStorage(iMomentStorage);
            if (!this_.startingMoment) {
                this_.startingMoment = tMoment;
            } else {
                if (tCurrMoment)
                    tCurrMoment.next = tMoment;
                tMoment.prev = tCurrMoment;
            }
            tCurrMoment = tMoment;
            if (iStorage.currentMomentIndex === iIndex)
                this_.currentMoment = tMoment;
        })

        //  this.currentMoment = this.startingMoment;   //  force current moment to be at the beginning
    }


    length() {
        //  todo: traverse the list to find the effective length.
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


    /**
     * Called from above. User has clicked on a particular moment, so we are about to time travel there.
     * Adjust this timeline (model) so that everything is set correctly.
     * @param iMoment   the moment being clicked on
     */

    handleDragStart(e: React.DragEvent, iMoment: Moment) {
        this.momentBeingDragged = iMoment;
    }

    handleDrop(x: number): Moment | null {
        let insertAfterThisMoment: Moment | null = null;     //  We will insert the dropped moment after this one.

        if (this.momentBeingDragged instanceof Moment) {
            this.currentMoment = this.momentBeingDragged;
            console.log("Dropping [" + this.momentBeingDragged.title + "] ");
            console.log(this.getMomentSummary());
            insertAfterThisMoment = this.startingMoment;
            let done: boolean = false;

            if (insertAfterThisMoment) {
                let ixMoment: Moment = insertAfterThisMoment;   //      index for list traversal

                while (!done) {
                    //  calculate position of the ixMoment box on the screen
                    const theElement: any = document.getElementById("DSMarker" + ixMoment.ID);
                    const momentRect: DOMRect = theElement.getBoundingClientRect();
                    const momentCenter = momentRect.left + momentRect.width / 2;

                    if (x < momentCenter) {     //  left half of ixMoment
                        done = true;
                        insertAfterThisMoment = ixMoment.prev;  //  is it's the first moment, this is null.
                    } else if (x < momentRect.right) {      //  right half of ixMoment
                        insertAfterThisMoment = ixMoment;
                        done = true;
                    }

                    if (ixMoment.next) {        //  next element in list
                        ixMoment = ixMoment.next;
                    } else {                    //  end of list? Insert after this last element.
                        insertAfterThisMoment = ixMoment;
                        done = true;
                    }
                }
            }

            if (this.momentBeingDragged !== insertAfterThisMoment) {
                this.removeMoment(this.momentBeingDragged);
                this.insertMomentAfterMoment(this.momentBeingDragged, insertAfterThisMoment);
                this.currentMoment = this.momentBeingDragged;   //  restore currentMoment, which was destroyed in the remove
            }
        }
        const returnValue: Moment | null = this.momentBeingDragged;
        this.momentBeingDragged = null;

        console.log(this.getMomentSummary());

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
     * @param newMoment    moment to insert
     * @param previousMoment  moment after which to insert it.
     */
    insertMomentAfterMoment(newMoment: Moment, previousMoment: Moment | null) {
        let subsequentMoment;

        if (previousMoment) {
            subsequentMoment = previousMoment.next;
            newMoment.prev = previousMoment;
            newMoment.next = subsequentMoment; //  null if at the end
            previousMoment.next = newMoment;
        } else {
            //   there are no moments in the list, e.g., at initialization
            //  or we're moving this moment to the beginning of the list, so
            //  previousMoment is null.
            newMoment.next = this.startingMoment;  //  which is null if the list is empty
            this.startingMoment = newMoment;
            newMoment.prev = null;
            subsequentMoment = newMoment.next;
        }
        if (subsequentMoment) {
            subsequentMoment.prev = newMoment;
        }
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
     * Create a moment, given a CODAP state.
     * Adds the moment to the array.
     * Makes it the currentMoment.
     * return a Moment based on that state.
     *
     * @param iCodapState
     */
    makeNewMomentUsingCodapState(iCodapState: any): Moment {
        /*
                if (!this.initialCodapState) {		//		is this the first marker? A new state?
                    this.moments = [];      //  blank the moment array
                    this.initialCodapState = iCodapState;
                }
        */

        let tNewMoment: Moment = new Moment(iCodapState);
        tNewMoment.ID = this.nextMomentID;    //  will be zero if this is new.
        this.nextMomentID += 1;     // the global number of IDs we have. Not moments.length in case of deletions.

        this.moments.push(tNewMoment);
        //  now, in the linked list, insert after the current ID.
        this.insertMomentAfterMoment(tNewMoment, this.currentMoment);

        tNewMoment.title = (tNewMoment.ID === 0) ? "start ... comienzo" : "Moment " + tNewMoment.ID;
        tNewMoment.narrative = tNewMoment.ID ? this.kInitialJSONText : this.kInitialJSONText_start;
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

    setNewTitle(iTitle: string): void {
        let theMoment = this.currentMoment;
        if (theMoment) theMoment.setTitle(iTitle);
    }

    getMomentSummary(): string {
        let out = `\n`;
        let m = this.startingMoment;
        while (m) {
            out += `m ${m.ID} `
                + ((m === this.currentMoment) ? "*" : " ")
                + `[${m.title}]`
                + "\n";
            m = m.next;
        }
        return out;
    }
}
