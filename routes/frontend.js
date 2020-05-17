const logger = require('logger').get('HTTP::Frontend');
const expressSession = require('express-session');
const AccountsAPI = require('../api/v2/accounts.js');
const { respond, requirePresenceOfParameter } = require('./util');
const cookieParser = require("cookie-parser"); 


let app = null;

const requireSignedIn = (req, res, next) => {
    if(req.session.user && req.session.user.isAuthenticated) {
        next();
    } else {
        res.redirect("/");
    }
}

const getCurrentDate = () => {
	let now = new Date();
	return now.toISOString();
}

// Public routes
//GET
//GET route for index/landing page
const index = (req, res) => {
	let lastVisited;
	if(req.cookies.lastVisitedIndex)
		lastVisited = req.cookies.lastVisitedIndex;
	else
		lastVisited = "Never";
	res.cookie("lastVisitedIndex", getCurrentDate(), {maxAge: 9999999999});
	res.render('landing', { session: req.session, lastVisited: lastVisited });
	
};

//GET route for login page
const login = (req, res) => {   
	let lastVisited;
	if(req.cookies.lastVisitedLogin) 
		lastVisited = req.cookies.lastVisitedLogin;
	else 
		lastVisited = "Never";
	res.cookie("lastVisitedLogin", getCurrentDate(), {maxAge: 9999999999}); 
	res.render('login', { session: req.session, failed: req.failed, lastVisited: lastVisited});
};

//GET route for signup page
const signUp = (req, res) => {
	let lastVisited;
	if(req.cookies.lastVisitedSignup) 
		lastVisited = req.cookies.lastVisitedSignup;
	else 
		lastVisited = "Never";
	res.cookie("lastVisitedSignup", getCurrentDate(), {maxAge: 9999999999}); 
	res.render('signup', { session: req.session, lastVisited: lastVisited });
};

//GET route for logout. Redirects to landing page
const logout = (req, res) => {
	req.session.destroy( err => {
        if(err) {
            console.log(err);
        }
        else {
            res.redirect('/');
        }
    })
};

//Post route for login form
const loginPost = (req, res) => {
	AccountsAPI.checkPassword(req.body.username, req.body.password).then( isOK =>{
		if(isOK) {
			newSession(req);
			res.redirect("/dashboard");
		}
		else {
			throw 'Username/password mismatch'; // this doesn't get used anywhere, but it tells us in code what's going on
		}
	}).catch(err => {
			req.failed = true;
			login(req, res);
	});

}


const newSession = req => {
	req.session.user = {
		isAuthenticated: true,
		username: req.body.username
	}
}
// Private routes
//GET

//GET route for dashboard page. Must be logged in to see
const dashboard = (req, res) => {
	let lastVisited;
	if(req.cookies.lastVisitedDashboard) {
		lastVisited = req.cookies.lastVisitedDashboard;
	}
	else {
		lastVisited = "Never";
	}
	res.cookie("lastVisitedDashboard", getCurrentDate(), {maxAge: 9999999999}); 
	res.render('dashboard', {
		session: req.session,
		lastVisited: lastVisited
	});
};


//GET route for account edit page. Must be logged in to see
const editAccount = (req, res) => {
	let lastVisited;
	if(req.cookies.lastVisitedEditAccount) {
		lastVisited = req.cookies.lastVisitedEditAccount;
	}
	else {
		lastVisited = "Never";
	}
	res.cookie("lastVisitedEditAccount", getCurrentDate(), {maxAge: 9999999999}); 
	AccountsAPI.get(req.session.user.username).then(account => {
		//console.log(account);
		let user = Object.assign({}, account, {dob: account.dob.toISOString().match(/^.*(?=T)/)[0]});
		//console.log(user);
		res.render('accountEdit', {
			session: req.session,
			user: user,
			lastVisited: lastVisited
		});
	}).catch(err => {
		console.log(err);
	});
	
};

// Generic error page
const errorPage = (err, req, res, next) => {
	if(err) {
		res.render('err', {
			code: res.statusCode,
			message: res.statusMessage
		});
	} else next();
};

//POST
//Post route for account edit form
const editAccPost = (req, res) => {
	console.log(req.body);
	AccountsAPI.checkPassword(req.session.user.username, req.body.password).then( isOK => {
		console.log(isOK);
		if(isOK) {
			AccountsAPI.get(req.session.user.username).then(account => {
				let answers = [];
				req.body.answers = [req.body.answer1, req.body.answer2, req.body.answer3];
				for(let i in req.body.answers) {
					if(isNaN(parseInt(req.body.answers[i]))) answers.push(account.answers[i]);
					else answers.push(parseInt(req.body.answers[i]));
				}
				Object.keys(req.body).forEach(key => {
					if(!req.body[key])
						delete req.body[key];
				});
				console.log(req.body);
				AccountsAPI.update(req.session.user.username, req.body).then(isOK => {
					if(req.body.username)
						req.session.user.username = req.body.username;	
					dashboard(req, res);
				}).catch(err => {editAccount(req, res);});
			
			});
		
		}
		else{
			editAccount(req, res);
		}
	}).catch(err => {editAccount(req, res);});
}

//Post route for signup form
const signupPost = (req, res) => {
	let user = {
		username: req.body.username,
		password: req.body.password,
		email: req.body.email,
		dob: req.body.dob,
		answers: [req.body.answer1, req.body.answer2, req.body.answer3]
	}

	AccountsAPI.create(user).then(isOK => {
		login(req, res);
	}).catch(err => {console.log(err)});
}


const routes = [
	{
		uri: '/',
		method: 'get',
		handler: index
	},

	{
		uri: '/login',
		method: 'get',
		handler: login
	},
	{
		uri: '/logout',
		method: 'get',
		handler: logout
	},

	{
		uri: '/signup',
		method: 'get',
		handler: signUp
	},

	{
		uri: '/dashboard',
		method: 'get',
		handler: [requireSignedIn, dashboard]
	},

	{
		uri: '/account/edit',
		method: 'get',
		handler: [requireSignedIn, editAccount]
	},

	{
		uri: '/login',
		method: 'post',
		handler: loginPost
	},
	{
		uri: '/account/edit',
		method: 'post',
		handler: editAccPost
	},
	{
		uri: '/signup',
		method: 'post',
		handler: signupPost
	}
	
	//,

	// {
	// 	method: 'use',
	// 	handler: errorPage
	// }

];

const configure = options => {
	app = options.app;
	app.use(expressSession({
		secret: process.env.EXPRESS_SESSION_SECRET,
		saveUninitialized: true,
		resave: true
	}));
	app.use(cookieParser("This is my passphrase"));

}

module.exports = { logger, routes, configure };
