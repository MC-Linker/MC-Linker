import { Mongoose } from 'mongoose';

/**
 * Convert a mongoose model to the new schema
 * @param {Mongoose} mongoose
 */
export function convert(mongoose) {
    const serverConnectionModel = mongoose.models.ServerConnection;

    // Convert all requiredRoleToJoin fields to arrays
    serverConnectionModel.find({ requiredRoleToJoin: { $type: 2 } }, (err, docs) => {
        if(err) {
            console.error(err);
            return;
        }

        docs.forEach(doc => {
            console.log(`Converting ${doc.id}...`);
            doc.requiredRoleToJoin = { method: 'any', roles: [doc.requiredRoleToJoin] };
            doc.save();
            console.log(`Converted ${doc.id}!`);
        });
    });
}
