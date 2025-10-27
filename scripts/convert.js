import { Mongoose } from 'mongoose';
import logger from '../utilities/logger.js';

export let convertedHttpServerIds = [];

/**
 * Convert a mongoose model to the new schema
 * @param {MCLinker} client
 * @param {Mongoose} mongoose
 */
export async function convert(client, mongoose) {
    const serverConnectionModel = mongoose.models.ServerConnection;

    const docs = await serverConnectionModel.find({ protocol: 'http' }).exec();
    logger.info(`Found ${docs.length} server connections with protocol http.`);
    for(const doc of docs) {
        convertedHttpServerIds.push(doc._id.toString());
        await serverConnectionModel.deleteOne({ _id: doc._id });
        logger.info(`Removed server connection with id ${doc._id} and protocol http.`);
    }
}
