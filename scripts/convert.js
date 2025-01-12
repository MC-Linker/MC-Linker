import { Mongoose } from 'mongoose';

/**
 * Convert a mongoose model to the new schema
 * @param {Mongoose} mongoose
 */
export async function convert(mongoose) {
    const serverConnectionModel = mongoose.models.ServerConnection;

    // Convert all requiredRoleToJoin fields to arrays
    const docs = await serverConnectionModel.find({}).exec();
    for(const doc of docs) {
        const oldDoc = { ...doc }._doc;

        console.log(`Converting ${oldDoc._id}...`);

        const newDoc = { servers: [{ ...oldDoc }] };
        delete newDoc.servers[0]._id;

        await serverConnectionModel.replaceOne({ _id: oldDoc._id }, newDoc).exec();

        console.log(`Converted ${oldDoc._id}!`);
    }
}
