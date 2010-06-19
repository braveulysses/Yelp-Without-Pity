// TODO: "Ignore This Reviewer" link should immediately hide review and add user to the blacklist
// TODO: only block links in the "div#reviews-other" section
// TODO: save settings to local storage

var blockedUsers = [];
// Test settings: Doryan R.,C. C.

String.prototype.trim = function() {
    // Thanks to: http://blog.stevenlevithan.com/archives/faster-trim-javascript
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
    console.log("Removing node");
    // TODO: Fade out element
    elem.parentNode.removeChild(elem);
    makePopSound();
    // TODO: Add user to list of blocked users
}

function makePopSound() {
    console.log("Sending makePopSound message");
    safari.self.tab.dispatchMessage("makePopSound");
}

function getSettings(callback) {
    var handler = function(event) {
        if (event.name == "yelpWithoutPitySettings") {
            if (event.message.blockedUsers != null) {
                blockedUsers = event.message.blockedUsers.split(",");
                console.log("Received blockedUsers setting: " + blockedUsers);
                callback(blockedUsers);
            }
        }
    }
    safari.self.addEventListener("message", handler, false);
    safari.self.tab.dispatchMessage("getYelpWithoutPitySettings");
}

function findReview(node, user) {
    // Takes a node within the review block.
    // Walk up the tree until we find the node with class='review'.
    var elem = node.parentNode;
    while (1) {
        if (elem.parentNode == null) {
            break;
        } else if (elem.className.split(" ").contains("review")) {
            console.log("Deleting review for user " + user);
            return elem;
        } else {
            elem = elem.parentNode;
        }
    }
    return null;
}

function findReviewerName(reviewNode) {
    // Assumes that we've already found the review node
    var reviewerNames = reviewNode.getElementsByClassName("reviewer_name");
    if (null != reviewerNames) {
        console.log("Determined user name to be " + reviewerNames[0].innerText);
        return reviewerNames[0].innerText;
    } else {
        return null;
    }
}

function findReviewByUser(user) {
    var xpathExpr = "//*[text() = '" + user + "']";
    console.log(xpathExpr);
    var reviewerNode = document.evaluate(
        xpathExpr, 
        document, 
        null, 
        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, 
        null
    );
    if (reviewerNode.snapshotLength > 0) {
        console.log("Found blocked user " + user);
        return findReview(reviewerNode.snapshotItem(0), user);
    }
}

function removeUnwantedReviews() {
    console.log("Looking for blocked users: " + blockedUsers);
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

function blockLinkHandler(event) {
    event.preventDefault();
    if (window.confirm("Are you sure you want to block this person?")) {
        console.log("Block link clicked");
        var reviewNode = findReview(this);
        if (null != reviewNode) {
            var reviewerName = findReviewerName(reviewNode);
            if (null != reviewerName) {
                console.log("Sending message to block user " + reviewerName);
                safari.self.tab.dispatchMessage("saveYelpWithoutPitySettings", reviewerName);
            }
            document.deleteNode(reviewNode);
        }
    }
    event.stopPropagation();
    return false;
}

function addBlockReviewerLinks() {    
    var blockLink = document.createElement("a");
    blockLink.setAttribute("href", "#");
    var blockText = document.createTextNode("Block This Reviewer");
    blockLink.appendChild(blockText);
    
    // var blockSpan = document.createElement("span");
    // blockSpan.appendChild(blockLink);
    
    var blockPara = document.createElement("p");
    blockPara.setAttribute("class", "smallest reviewIntLinks");
    // blockPara.appendChild(blockSpan);
    blockPara.appendChild(blockLink);
    
    var othersReviews = document.getElementById("reviews-other");
    var reviewTopBars = othersReviews.getElementsByClassName("reviewTopBar");
    for (var i=0; i < reviewTopBars.length; i++) {
        console.log("Adding block link");
        var newBlockLink = blockPara.cloneNode(true);
        newBlockLink.addEventListener("click", blockLinkHandler, false);
        reviewTopBars[i].appendChild(newBlockLink);
    }
}

safari.self.tab.dispatchMessage("initYelpWithoutPitySettings");
addBlockReviewerLinks();
removeUnwantedReviews();

