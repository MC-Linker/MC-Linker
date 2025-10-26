import { Mongoose } from 'mongoose';

/**
 * Convert a mongoose model to the new schema
 * @param {MCLinker} client
 * @param {Mongoose} mongoose
 */
export async function convert(client, mongoose) {
    const serverConnectionModel = mongoose.models.ServerConnection;

    // TODO Remove all http type server connections
    /*    const docs = await serverConnectionModel.find({ protocol: 'http' }).exec();
        console.log(`[${client.shard.ids[0]}] Found ${docs.length} server connections with protocol http.`);
        for(const doc of docs) {
            //Fetch guild
            const guild = await client.guilds.fetch(doc._id);
            await sendToServer(guild, keys.main.warnings.http_deprecated);

            await serverConnectionModel.deleteOne({ _id: doc._id });
            console.log(`[${client.shard.ids[0]}] Removed server connection with id ${doc._id} and protocol http.`);
        }*/
}
