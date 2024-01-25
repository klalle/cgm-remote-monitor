//read env-files (not used by heroku task!)
const dotenv = require('dotenv');
dotenv.config();
const MongoClient = require('mongodb').MongoClient;
const mongo = {
    client: null,
    db: null,
};
const options = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
};

async function connectToMongo() {
    if (mongo.db != null) {
        return [mongo.db, mongo.client];
    }
    var url = process.env.MONGODB_URI || process.env.MONGO_CONNECTION || 'mongodb://username:password@localhost:27017/Nightscout';
    mongo.client = new MongoClient(url, options);

    try {
        await mongo.client.connect();

        console.info('Successfully established connection to MongoDB');

        const dbName = mongo.client.s.options.dbName;
        mongo.db = mongo.client.db(dbName);
        if (!db) {
            console.info("database not found: " + dbName);
            return false;
        }else{
            console.info('connected to db: ' + dbName);
        }
        const result = await mongo.db.command({ connectionStatus: 1 });
        const roles = result.authInfo.authenticatedUserRoles;
        console.info('Mongo user role seems ok:', roles);

    } catch (err) {
        if (err.message && err.message.includes('AuthenticationFailed')) {
            console.info('Authentication to Mongo failed');
            return;
        }

        if (err.name && err.name === "MongoServerSelectionError") {

            console.info('Error connecting to MongoDB' + err);
        } else {
            console.info('MONGODB_URI seems invalid: ' + err.message + " uri:" + url);
        }
    }

    return true;
}

async function getData(table, column, value, limitEntries = 100000, creationDateFrom = null, creationDateTo = new Date().toISOString()) {
    console.info("Kitescout backend: get " + value + " Data");

    if(await connectToMongo() == false){
        console.info("error connecting to mongo!");
        return;
    }

    var returnArray = [];
    const findObj = value ? { [column]: value } : {};
    // if (creationDateFrom && value==="sgv"){
    //     findObj["dateString"] = { "$gt": creationDateFrom, "$lt": creationDateTo };
    // } else if(creationDateFrom){
    findObj["created_at"] = { "$gt": creationDateFrom, "$lt": creationDateTo };
    // }
    try {
        //fetch nrOfEntries nr of entries from column in table
        returnArray = await mongo.db.collection(table)
            .find(findObj)
            .sort({ $natural: -1 }) //bottomsup
            .limit(Number(limitEntries))
            .toArray();
        //if(value == "sgv"){
        //        console.info(findObj)
        console.info("results: (table: " + table + ") returned: " + returnArray.length);
        //console.log("db." + table + ".find({\n\tcreated_at:{\n\t\t$gt: '" + creationDateFrom  + "',\n\t\t$lt: '" + creationDateTo + "'\n\t}\n}).sort({created_at:-1});")
        //console.info("results[0]: " + JSON.stringify(returnArray, null, 2));        
        //}
    } catch (err) {
        console.err(err);
        console.info(err);
    } finally {
        // close the connection to db when you are done with it
        // client.close();
    }

    return returnArray;
};

async function getProfile(datefrom) {
    //console.log("get" + value + "Count");

    if(await connectToMongo() == false){
        console.info("error connecting to mongo!");
        return;
    }
    var returnArray = [];
    try {
        const findObj = {
            eventType: "Profile Switch",
            duration: 0,
            created_at: { "$lte": datefrom }
        };
        //fetch date of last real profile switch that affects the firstdate
        let dateOfFirstP = await mongo.db.collection("treatments")
            .find(findObj, { projection: { created_at: 1 } })
            .sort({ $natural: -1 }) //bottomsup
            .limit(1)
            .next();

        const findObj2 = {
            eventType: "Profile Switch",
            created_at: { "$gte": dateOfFirstP.created_at }
        };
        returnArray = await mongo.db.collection("treatments")
            .find(findObj2, { projection: { _id: 0 } })
            .sort({ $natural: -1 }) //bottomsup
            .toArray();

    } catch (err) {
        console.info(err);
    } finally {
        // close the connection to db when you are done with it
        // client.close();
    }

    return returnArray;
};

module.exports = { getData, getProfile }