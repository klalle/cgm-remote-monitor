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
        return true;
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
        }

        if (err.name && err.name === "MongoServerSelectionError") {

            console.info('Error connecting to MongoDB' + err);
        } else {
            console.info('MONGODB_URI seems invalid: ' + err.message + " uri:" + url);
        }
        return false;
    }
    return true;
}

async function updatedb(nrToAdd, Typ, source, resetdb = false) {
    
    if (isNaN(+nrToAdd)) {
        console.info("Not a number!");
        return;
    }
    if(await connectToMongo() == false){
        console.info("error connecting to mongo!");
        return;
    }
    
    var count = 0;
    var lastKnownChange = new Date().toISOString();
    try {
        
        //fetch last entry in omnipodstash
        let doc = await mongo.db.collection("omnipodstash")
            .find({ Type: Typ }, { projection: { _id: 0 } })
            .sort({ $natural: -1 }) //bottomsup
            .limit(1)
            .next();
        if (doc != null) {
            if (!resetdb) {
                count = doc.Count;
                lastKnownChange = doc.LastKnownChange;
            }
            console.info('count: ' + count);
            console.info('lastKnownChange: ' + lastKnownChange);
        }

        var operation = "Manual Add";
        if (resetdb) {
            operation = "Manual SetCount";
        }

        //create new db-object
        var dbEntity = {
            date: new Date().toISOString(),
            diff: Number(nrToAdd),
            Count: parseInt(count) + parseInt(nrToAdd),
            LastKnownChange: lastKnownChange,
            Operation: operation,
            Type: Typ,
            Source: source
        };
        //update omnipodstash with latest: 
        await mongo.db.collection("omnipodstash").insertOne(dbEntity);

        console.info("1 document inserted:");
        console.info(dbEntity);

    } catch (err) {
        console.info(err);
    } finally {
        // close the connection to db when you are done with it
        //dbClient.close();
    }
};

async function getCount(Typ) {
    console.info("get" + Typ + "Count");
    
    if(await connectToMongo() == false){
        console.info("error connecting to mongo!");
        return;
    }

    var count = "-";
    try {
        //fetch last entry in omnipodstash
        let doc = await mongo.db.collection("omnipodstash")
            .find({ Type: Typ }, { projection: { _id: 0 } })
            .sort({ $natural: -1 }) //bottomsup
            .limit(1)
            .next();
        if(!doc){
            await mongo.db.createCollection("omnipodstash");
        }else{
            count = doc ? doc.Count : "-";
        }
        console.info('count: ' + count);

    } catch (err) {
        console.info(err);
    } finally {
        // close the connection to db when you are done with it
        //dbClient.close();
    }

    return count;
};

async function getLastActions(Typ, nrOfLogs) {
    console.info("get" + Typ + " lastLogs nrOfLogs: " + nrOfLogs);
    
    if(await connectToMongo() == false){
        console.info("error connecting to mongo!");
        return;
    }

    var returnArray = [];
    try {
        //fetch last entry in omnipodstash
        returnArray = await mongo.db.collection("omnipodstash")
            .find({ Type: Typ }, { projection: { _id:0 } })
            .sort({ $natural: -1 }) //bottomsup
            .limit(Number(nrOfLogs))
            .toArray();

        //console.info("returnArray:");
        //console.info(returnArray);

    } catch (err) {
        console.info(err);
    } finally {
        // close the connection to db when you are done with it
        //dbClient.close();
    }

    return returnArray;
};

async function resetCount(Typ) {
    console.info("resetting db counter to 0");
    if(await connectToMongo() == false){
        console.info("error connecting to mongo!");
        return;
    }
    try {

        //create new db-object
        var dbEntity = {
            date: new Date().toISOString(),
            diff: 0,
            Count: 0,
            LastKnownChange: new Date().toISOString(),
            Operation: "Api Reset",
            Type: Typ,
            Source: "reset"
        };

        //update omnipodstash with latest: 
        await mongo.db.collection("omnipodstash").insertOne(dbEntity);

        console.info("1 document inserted:");
        console.info(dbEntity);

    } catch (err) {
        console.info(err);
    } finally {
        // close the connection to db when you are done with it
        //dbClient.close();
    }
};
module.exports = { updatedb, getCount, getLastActions, resetCount }