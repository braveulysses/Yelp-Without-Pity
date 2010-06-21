/*                                                      , _           
 * (|  |  _ |\                o_|_ |)    _       _|_    /|/ \o_|_      
 *  |  | |/ |/ |/\_   |  |  |_| |  |/\  / \_|  |  |      |__/| |  |  | 
 *   \/|/|_/|_/|_/     \/ \/  |/|_/|  |/\_/  \/|_/|_/    |   |/|_/ \/|/
 *    (|      (|                                                    (|
 */

/**********************************************************************
 *
 * Settings
 *
 **********************************************************************/

var ywpSettings = new Object;

// When passed as a transaction error handler, this will cause the 
// transaction to fail with a warning message.
ywpSettings.errorHandler = function(transaction, error) {
    console.log("Yelp Without Pity settings error: " + error.message + ", " + error.code);
    return true;
}

// This is used as a data handler for a request that returns no data. 
ywpSettings.nullDataHandler = function(transaction, results) {}

// Returns an instance of the settings database. 
ywpSettings.getSettingsDatabase = function() { 
    try { 
        var shortName = "yelpWithoutPityDB"; 
        var version = "1.0"; 
        var displayName = "Yelp Without Pity Settings Database"; 
        var maxSize = 65536; 
        var db = openDatabase(shortName, version, displayName, maxSize);
        return db; 
    } catch (e) { 
        if (e == 2) { 
            console.log("Invalid Yelp Without Pity settings DB version."); 
        } else { 
            console.log("Unknown error opening Yelp Without Pity settings DB: " + e); 
        } 
        return null; 
    } 
}

// Creates the blocked users table if it doesn't already exist. 
ywpSettings.initSettingsDatabase = function(db) {
    db.transaction(
        function(transaction) { 
            transaction.executeSql( 
                'CREATE TABLE IF NOT EXISTS blockedUsers(name TEXT NOT NULL PRIMARY KEY);', 
                [], 
                ywpSettings.nullDataHandler,
                ywpSettings.errorHandler 
            ); 
        }
    ); 
}

// Gets the list of blocked users from the settings database.
ywpSettings.getBlockedUsers = function(db, callback) {
    var blockedUsers = [];
    db.transaction( 
        function(transaction) {
            transaction.executeSql( 
                "SELECT * FROM blockedUsers;", 
                [],
                function(transaction, results) { 
                    for (var i=0; i < results.rows.length; i++) {
                        blockedUsers.push(results.rows.item(i)['name']);
                    }
                    callback(blockedUsers);
                }, 
                ywpSettings.errorHandler 
            ); 
        } 
    );
}

// Adds a blocked user to the settings database.
ywpSettings.addBlockedUser = function(db, username) {  
    db.transaction(
        function(transaction) {
            transaction.executeSql( "INSERT INTO blockedUsers (name) VALUES (?);", 
                [ username ], 
                ywpSettings.nullDataHandler, 
                ywpSettings.errorHandler 
            ); 
        } 
    ); 
}

/**********************************************************************
 *
 * Utility functions
 *
 **********************************************************************/

// Trims leading and trailing whitespace.
// Thanks to: http://blog.stevenlevithan.com/archives/faster-trim-javascript
String.prototype.trim = function() {
    return this.replace(/^\s*([\S\s]*?)\s*$/, '$1');
}

Array.prototype.contains = function(obj) {
    var i = this.length;
    while (i--) {
        if (this[i] === obj) {
            return true;
        }
    }
    return false;
}

Object.prototype.deleteNode = function(elem) {
    elem.parentNode.removeChild(elem);
}

function getSettings(callback) {
    var db = ywpSettings.getSettingsDatabase();
    ywpSettings.getBlockedUsers(db, callback);
}

function saveSetting(reviewerName) {
    var db = ywpSettings.getSettingsDatabase();
    ywpSettings.addBlockedUser(db, reviewerName);
}

/**********************************************************************
 *
 * Find reviews
 *
 **********************************************************************/

function findReview(node) {
    // Expects a node within the review block.
    // Walks up the tree until a node with class='review' is found.
    var elem = node.parentNode;
    while (1) {
        if (elem.parentNode == null) {
            break;
        } else if (elem.className.split(" ").contains("review")) {
            return elem;
        } else {
            elem = elem.parentNode;
        }
    }
    return null;
}

function findReviewByUser(user) {
    var xpathExpr = "//*[@id='reviews-other']//*[text() = '" + user + "']";
    var reviewerNode = document.evaluate(
        xpathExpr, 
        document, 
        null, 
        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, 
        null
    );
    if (reviewerNode.snapshotLength > 0) {
        // console.log("findReviewByUser: Found blocked user " + user);
        return findReview(reviewerNode.snapshotItem(0));
    }
}

function findReviewerName(reviewNode) {
    var reviewerNames = reviewNode.getElementsByClassName("reviewer_name");
    if (null != reviewerNames) {
        return reviewerNames[0].innerText;
    } else {
        return null;
    }
}

/**********************************************************************
 *
 * Review hiding
 *
 **********************************************************************/

function removeReviews() {
    getSettings(function(blockedUsers) {
        blockedUsers.forEach(function(user) {
            user = user.trim();
            var review = findReviewByUser(user);
            if (null != review) {
                document.deleteNode(review);
            }
        }); 
    });
}

/**********************************************************************
 *
 * "Block This Reviewer" links
 *
 **********************************************************************/

function blockLinkClickHandler(event) {
    event.preventDefault();
    if (window.confirm("Are you sure you want to block this person?")) {
        var reviewNode = findReview(this);
        if (null != reviewNode) {
            var reviewerName = findReviewerName(reviewNode);
            if (null != reviewerName) {
                saveSetting(reviewerName);
            }
            document.deleteNode(reviewNode);
        }
    }
    event.stopPropagation();
    return false;
}

function addBlockLinks() {
    var blockLink = document.createElement("a");
    blockLink.setAttribute("href", "#");
    var blockText = document.createTextNode("Block This Reviewer");
    blockLink.appendChild(blockText);
    
    var blockPara = document.createElement("p");
    blockPara.setAttribute("class", "smallest reviewIntLinks");
    blockPara.appendChild(blockLink);
    
    var othersReviews = document.getElementById("reviews-other");
    var reviewTopBars = othersReviews.getElementsByClassName("reviewTopBar");
    for (var i=0; i < reviewTopBars.length; i++) {
        var newBlockLink = blockPara.cloneNode(true);
        newBlockLink.addEventListener("click", blockLinkClickHandler, false);
        reviewTopBars[i].appendChild(newBlockLink);
    }
}

/**********************************************************************
 *
 * Main
 *
 **********************************************************************/

var db = ywpSettings.getSettingsDatabase();
if (null != db) {
    ywpSettings.initSettingsDatabase(db);
    addBlockLinks();
    removeReviews();
}

