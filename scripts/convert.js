import { Mongoose } from 'mongoose';

/**
 * Convert a mongoose model to the new schema
 * @param {Mongoose} mongoose
 */
export async function convert(mongoose) {
    const serverConnectionModel = mongoose.models.ServerConnection;

    // Convert all requiredRoleToJoin fields to arrays
    const docs = await serverConnectionModel.find({ requiredRoleToJoin: { $type: 2 } }).exec();
    for(const doc of docs) {
        console.log(`Converting ${doc._id}...`);
        doc.requiredRoleToJoin = { method: 'any', roles: [doc.requiredRoleToJoin] };
        await serverConnectionModel.updateOne({ _id: doc._id }, doc);
        console.log(`Converted ${doc._id}!`);
    }
}
