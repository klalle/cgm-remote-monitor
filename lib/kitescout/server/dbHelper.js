//read env-files (not used by heroku task!)
const dotenv = require('dotenv');
dotenv.config();

async function connectToMongo() {
    var url = process.env.MONGODB_URI || 'mongodb://mongoadmin:mongoadmin@localhost:27017/Nightscout'
    const dbName = url.split("?")[0].split("/")[3];
    
    // create a client to mongodb
    var MongoClient = require('mongodb').MongoClient;

    // make client connect to mongo service
    const dbClient = await MongoClient.connect(url);
    if (!dbClient) {
        console.error("failed to connect to mongodb!\nCheck your connection string: " + uri)
        console.info("failed to connect to mongodb!\nCheck your connection string: " + uri)
        return;
    }
    var db = null;
    try {
        db = dbClient.db(dbName);

    } catch (err) {
        dbClient.close();
        console.error(err);
        return;
    }
    return [db, dbClient];
}

async function getData(table, column, value, limitEntries = 100000, creationDateFrom = null, creationDateTo = new Date().toISOString()) {
    console.info("get" + value + "Count");

    const [db, dbClient] = await connectToMongo();
    if (!db) return;

    var returnArray = [];
    const findObj = value ? { [column]: value } : {};
    if (creationDateFrom && value==="sgv"){
        findObj["dateString"] = { "$gt": creationDateFrom, "$lt": creationDateTo };
    } else if(creationDateFrom){
        findObj["created_at"] = { "$gt": creationDateFrom, "$lt": creationDateTo };
    }
    try {
        //fetch nrOfEntries nr of entries from column in table
        returnArray = await db.collection(table)
            .find(findObj)
            .sort({ $natural: -1 }) //bottomsup
            .limit(Number(limitEntries))
            .toArray();
        if(value == "sgv"){
            console.info(findObj)
            console.info("results: " + returnArray.length);
            //console.log("db." + table + ".find({\n\tcreated_at:{\n\t\t$gt: '" + creationDateFrom  + "',\n\t\t$lt: '" + creationDateTo + "'\n\t}\n}).sort({created_at:-1});")
        }
    } catch (err) {
        console.err(err);
        console.info(err);
    } finally {
        // close the connection to db when you are done with it
        dbClient.close();
    }

    return returnArray;
};

async function getProfile(datefrom) {
    //console.log("get" + value + "Count");

    const [db, dbClient] = await connectToMongo();
    if (!db) return;

    var returnArray = [];
    try {
        const findObj = {
            eventType: "Profile Switch",
            duration: 0,
            created_at: { "$lte": datefrom }
        };
        //fetch date of last real profile switch that affects the firstdate
        let dateOfFirstP = await db.collection("treatments")
            .find(findObj, { projection: { created_at: 1 } })
            .sort({ $natural: -1 }) //bottomsup
            .limit(1)
            .next();

        const findObj2 = {
            eventType: "Profile Switch",
            created_at: { "$gte": dateOfFirstP.created_at }
        };
        returnArray = await db.collection("treatments")
            .find(findObj2, { projection: { _id: 0 } })
            .sort({ $natural: -1 }) //bottomsup
            .toArray();

    } catch (err) {
        console.log(err);
    } finally {
        // close the connection to db when you are done with it
        dbClient.close();
    }

    return returnArray;
};

module.exports = { getData, getProfile }