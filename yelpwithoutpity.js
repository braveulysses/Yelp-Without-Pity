/*                                                       , _           
 * (|  |  _ |\                o_|_ |)    _       _|_    /|/ \o_|_      
 *  |  | |/ |/ |/\_   |  |  |_| |  |/\  / \_|  |  |      |__/| |  |  | 
 *   \/|/|_/|_/|_/     \/ \/  |/|_/|  |/\_/  \/|_/|_/    |   |/|_/ \/|/
 *    (|      (|                                                    (|
 */

/**********************************************************************
 *
 * Classes
 *
 **********************************************************************/

function YelpReviewer() {}
YelpReviewer.prototype.id = "";
YelpReviewer.prototype.name = "";

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
        var version = "1.1"; 
        var displayName = "Yelp Without Pity Settings Database"; 
        var maxSize = 65536; 
        var db = openDatabase(shortName, version, displayName, maxSize);
        return db; 
    } catch (e) { 
        if (e == "1.0") { 
            console.log("Found old Yelp Without Pity settings DB version. Please remove it.");
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
                'CREATE TABLE IF NOT EXISTS blockedYelpers(yelper_name TEXT NOT NULL, yelper_id TEXT NOT NULL PRIMARY KEY);', 
                [], 
                ywpSettings.nullDataHandler,
                ywpSettings.errorHandler 
            ); 
        }
    );
}

// Gets the list of blocked users from the settings database.
ywpSettings.getBlockedYelpers = function(db, callback) {
    var blockedUsers = [];
    db.transaction( 
        function(transaction) {
            transaction.executeSql( 
                "SELECT yelper_name, yelper_id FROM blockedYelpers;", 
                [],
                function(transaction, results) { 
                    for (var i=0; i < results.rows.length; i++) {
                        var user = new YelpReviewer();
                        user.name = results.rows.item(i)['yelper_name'];
                        user.id = results.rows.item(i)['yelper_id'];
                        blockedUsers.push(user);
                    }
                    callback(blockedUsers);
                }, 
                ywpSettings.errorHandler 
            ); 
        } 
    );
}

// Adds a blocked user to the settings database.
ywpSettings.addBlockedUser = function(db, username, id) {  
    db.transaction(
        function(transaction) {
            transaction.executeSql(
                "INSERT INTO blockedYelpers (yelper_name, yelper_id) VALUES (?, ?);", 
                [ username, id ], 
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
    ywpSettings.getBlockedYelpers(db, callback);
}

function saveSetting(reviewerName, reviewerId) {
    var db = ywpSettings.getSettingsDatabase();
    ywpSettings.addBlockedUser(db, reviewerName, reviewerId);
}

/**********************************************************************
 *
 * Detect login status
 *
 **********************************************************************/

function isLoggedIn() {
    if (null != document.getElementById("user_identify")) {
        return true;
    } else {
        return false;
    }
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

function findReviewByUser(username) {
    var xpathExpr = "//*[@id='reviews-other']//*[text()='" + username + "']";
    var reviewerNode = document.evaluate(
        xpathExpr, 
        document, 
        null, 
        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, 
        null
    );
    if (reviewerNode.snapshotLength > 0) {
        return findReview(reviewerNode.snapshotItem(0));
    }
}

function findReviewById(userId) {
    var url = "/user_details?userid=" + userId;
    var xpathExpr = "//*[@id='reviews-other']//a[@href='" + url + "']";
    var reviewerNode = document.evaluate(
        xpathExpr, 
        document, 
        null, 
        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, 
        null
    );
    if (reviewerNode.snapshotLength > 0) {
        return findReview(reviewerNode.snapshotItem(0));
    }
}

function getIdFromUrl(url) {
    var id = null;
   // Typical URL: http://www.yelp.com/user_details?userid=blabblahblah
   // This should work if other query params are present, too.
   var queryParams = url.split("?")[1].split("&");
   if (null != queryParams) {
       queryParams.forEach(function(qp) {
           var arg = qp.split("=");
           if (arg[0] == "userid") {
               // Unfortunately, can't break from here
               id = arg[1];
           }
       });
   }
   return id;
}

function getReviewerInfo(reviewNode) {
    var reviewerNames = reviewNode.getElementsByClassName("reviewer_name");
    if (null != reviewerNames) {
        var reviewer = new YelpReviewer();
        reviewer.name = reviewerNames[0].innerText;
        reviewer.id = getIdFromUrl(reviewerNames[0].getAttribute("href"));
        return reviewer;
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
            var review = findReviewById(user.id);
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
            var reviewer = getReviewerInfo(reviewNode);
            if (null != reviewer) {
                saveSetting(reviewer.name, reviewer.id);
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
    
    var otherReviews = document.getElementById("reviews-other");
    if (null != otherReviews) {
        if (isLoggedIn()) {
            var blockPara = document.createElement("p");
            blockPara.setAttribute("class", "smallest reviewIntLinks");
            blockPara.appendChild(blockLink);
            
            var reviewTopBars = otherReviews.getElementsByClassName("reviewTopBar");
            for (var i=0; i < reviewTopBars.length; i++) {
                var newBlockLink = blockPara.cloneNode(true);
                newBlockLink.addEventListener("click", blockLinkClickHandler, false);
                reviewTopBars[i].appendChild(newBlockLink);
            }
        } else {
            var blockPara = document.createElement("p");
            blockPara.setAttribute("class", "reviewer_info");
            blockPara.appendChild(blockLink);
            
            var reviews = otherReviews.getElementsByClassName("reviewer");
            for (var i=0; i < reviews.length; i++) {
                var newBlockLink = blockPara.cloneNode(true);
                newBlockLink.addEventListener("click", blockLinkClickHandler, false);
                reviews[i].appendChild(newBlockLink);
            }
        }
        return true;
    } else {
        return false;
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
    if (addBlockLinks()) {
        removeReviews();
    }
}

