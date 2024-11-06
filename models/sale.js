import { Schema, model } from 'mongoose'
import { generateUniqueIdentifier } from '../utils/utils.js'

const saleSchema = Schema({
    leadId: { type: Schema.Types.ObjectId, ref: 'Lead', required: false },
    staff: { type: String, required: false },
    clientName: { type: String, required: false },
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: false },
    propertyType: { type: String, required: false },
    totalAmount: { type: Number, required: false },
    receivedAmount: { type: Number, required: false },
    buyingPrice: { type: Number, required: false },
    profit: { type: Number, required: false },
    uid: { type: String },
}, { timestamps: true })


// Before saving a new document, generate a unique readable identifier
saleSchema.pre('save', async function (next) {
    if (!this.uid) {
        let isUnique = false;
        let generatedIdentifier;

        while (!isUnique) {
            // Generate a unique identifier (you can use a library for this)
            generatedIdentifier = generateUniqueIdentifier();

            // Check if it's unique in the collection
            const existingDocument = await this.constructor.findOne({ uid: generatedIdentifier });

            if (!existingDocument) {
                isUnique = true; // Identifier is unique, exit the loop
            }
        }

        // Assign the generated identifier to the document
        this.uid = generatedIdentifier;
    }
    next();
});

const saleModel = model('Sale', saleSchema)
export default saleModel