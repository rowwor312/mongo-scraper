var express = require("express");
var bodyParser = require("body-parser");
var logger = require("morgan");
var mongoose = require("mongoose");
var path = require("path");

// Requiring Note and Article models
var Note = require("./models/Note.js");
var Article = require("./models/Article.js");

// Scraping 
var axios = require("axios");
var cheerio = require("cheerio");

//Port 3000
var port = process.env.PORT || 3000

// Initialize Express
var app = express();

// Use morgan and body parser with our app
app.use(logger("dev"));
app.use(bodyParser.urlencoded({
  extended: true
}));

// Make public a static dir
app.use(express.static("public"));

// Set Handlebars.
var exphbs = require("express-handlebars");

app.engine("handlebars", exphbs({
    defaultLayout: "main",
    partialsDir: path.join(__dirname, "/views/layouts/partials")
}));
app.set("view engine", "handlebars");

// If deployed, use the deployed database. Otherwise use the local mongoHeadlines database
var MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost/mongoHeadlines";

// Set mongoose to leverage built in JavaScript ES6 Promises
// Connect to the Mongo DB
mongoose.Promise = Promise;
mongoose.connect(MONGODB_URI);

//mongoose.connect("mongodb://localhost/mongoscraper");
// var db = mongoose.connection;

// db.on("error", function(error) {
//   console.log("Mongoose Error: ", error);
// });

// // Once logged in to the db through mongoose, log a success message
// db.once("open", function() {
//   console.log("Mongoose connection successful.");
// });
// Routes
// ======

//GET requests to render Handlebars pages
app.get("/", function(req, res) {
  Article.find({saved: false}, function(error, data) {
    var hbsObject = {
      article: data
    };
    console.log(hbsObject);
    res.render("home", hbsObject);
  });
});

app.get("/saved", function(req, res) {
  Article.find({saved: true})
  .populate("notes")
  .then(function(articleDb) {
    var hbsObject = {
      article: articleDb
    };
    res.json("saved", hbsObject);
  });
});

// A GET request to scrape the website
app.get("/scrape", function(req, res) {
  
  axios.get("https://www.nytimes.com").then(function(response) {
   
    var $ = cheerio.load(response.data);
    // Grab all h2 within an article tag
    $("article").each(function (i, element) {
     
      var result = {};
      console.log(result)
      // Add the title and summary of every link, and save them as properties of the result object
      result.title = $(this)
        .find("a")
        .text();
        console.log("this is title: " + result.title)
      result.summary = $(this)
        .find("span")
        .text();
        console.log("this is summary: " + result.summary)
      result.link = $(this)
        .children("a")
        .attr("href");
        console.log("this is link: " + result.link)

      // Using our Article model, create a new entry
      // This effectively passes the result object to the entry (and the title and link)
    

      // Now, save that entry to the db
      Article.create(result)
        .then(function(articleDb) {
          console.log(articleDb)
        })
        .catch(function(err) {
          res.json(err)
          console.log(err)
        })
      });
      res.send("Scrape Complete");
    });
  });
  // Tell the browser that we finished scraping the text


// This will get the articles we scraped from the mongoDB
app.get("/articles", function(req, res) {
  // Grab every doc in the Articles array
  Article.find({})
    .then(function(articleDb) {
      res.json(articleDb)
    })
    .catch(function(err) {
      res.json(err);
    })
});

// Grab an article by it's Id
app.get("/articles/:id", function(req, res) {
  // Using the id passed in the id parameter, prepare a query that finds the matching one in our db...
  Article.findOne({ _id: req.params.id })
  // ..and populate all of the notes associated with it
  .populate("note")
  // execute our query
  .then(function(articleDb) {
    res.json(articleDb);
  })
  .catch(function(err) {
    res.json(err);
  });
});


// Save an article
app.post("/articles/save/:id", function(req, res) {
      // Use the article id to find and update its saved boolean
    Note.create(req.body)
    .then(function(noteDb) {
      return Article.findOneAndUpdate({ _id: req.params.id }, { saved: true})
      // Execute the above query
    })
    .then(function(articleDb) {
      res.json(articleDb)
    })
    .catch(function(err) {
      res.json(err);
    });
});


// Delete an article
app.post("/articles/delete/:id", function(req, res) {
      // Use the article id to find and update its saved boolean
  Article.findOneAndUpdate({ _id: req.params.id }, { saved: false, notes: []})
      // Execute the above query
    .then(function(articleDb) {
        // Log any errors
      res.json(articleDb)
    })
    .catch(function(err) {
      res.json(err)
    });
});


// Create a new note
app.post("/notes/save/:id", function(req, res) {
  // Create a new note and pass the req.body to the entry
  // var newNote = new Note({
  //   body: req.body.text,
  //   article: req.params.id
  // });
  console.log(req.body)
  // And save the new note the db
  Note.create(req.body)
    .then(function(noteDb) {
      // Use the article id to find and update it's notes
      return Article.findOneAndUpdate({ _id: req.params.id }, {$push: { notes: note } })
      // Execute the above query
    })
    .then(function(articleDb) {
        // Log any errors
        
      res.json(articleDb);
    })
    .catch(function(err) {
          // Or send the note to the browser
      res.json(err);
    })
  });

  


// Delete a note
app.delete("/notes/delete/:note_id/:article_id", function(req, res) {
  // Use the note id to find and delete it
  
  Note.findOneAndRemove({ _id: req.params.note_id }, function(err) {
    // Log any errors
  })
   .then(function(articleDb) {
      return Article.findOneAndUpdate({ _id: req.params.article_id }, {$pull: {notes: req.params.note_id}})
       // Execute the above query
    .then(function(articleDb) {
        // Log any errors
      res.json(articleDb)
    })
    .catch(function(err) {
      res.json(err)
    });
      
    })
  });
;

// Listen on port
app.listen(port, function() {
  console.log("App running on port " + port);
});