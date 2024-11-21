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
        console.log(`Converting ${doc._id}...`);

        const newDoc = {
            _id: doc._id,
            serverSettings: doc.serverSettings,
            servers: [{ ...doc }],
        };
        delete newDoc.servers[0]._id;
        delete newDoc.servers[0].serverSettings;

        await serverConnectionModel.updateOne({ _id: doc }, newDoc).exec();

        console.log(`Converted ${doc._id}!`);
    }
}
