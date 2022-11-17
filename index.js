import express from 'express';
import { engine } from 'express-handlebars';

import flash from 'express-flash';
import session from 'express-session';

import Pgp from 'pg-promise';
import ShortUniqueId from 'short-unique-id';

const app = express();
const pgp = Pgp();
const uid = new ShortUniqueId({ length: 5 });

app.engine('handlebars', engine());
app.set('view engine', 'handlebars');
app.set('views', './views');

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(express.static('public'));

// initialise session middleware - flash-express depends on it
app.use(session({
    secret: "fehrt6912",
    resave: false,
    saveUninitialized: true
}));

// initialise the flash middleware
app.use(flash());

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://eater:eat123@localhost:5432/fruit_eater";

const config = {
    connectionString: DATABASE_URL
}

if (process.env.NODE_ENV == 'production') {
    config.ssl = {
        rejectUnauthorized: false
    }
}

const db = pgp(config);

app.use(function (req, res, next) {

    // console.log(r);
    // console.log('in my middleware...' + req.path);

    const noLoginNeeded = {
        '/login' : true,
        '/register' : true,
        // '/admin' : true,
    };

    if (noLoginNeeded[req.path]) {
        next();
    } else {

        // add a road block - or check before we proceed.
        if (!req.session.user) {
            res.redirect('/login');
            return;
        }
        next();
    }

});

app.get('/logout', function (req, res) {
    delete req.session.user;

    res.redirect('/login');

})


app.post("/add/", async (req, res) => {

    const { fruitId, day, qty } = req.body;
    const userId = req.session.user.id;

    if (fruitId && day) {
        await db.none(
            `insert into eaten (user_id, fruit_id, eaten_on, qty) values ($1, $2, $3, $4)`,
            [userId, fruitId, day, qty || 1]);
        req.flash('success', 'Fruit entry added');
    } else {
        req.flash('error', 'Select a fruit & date');
    }
    res.redirect("/");
});

app.get("/", async (req, res) => {

    // no longer checking the username...

    const fruits = await db.manyOrNone('select * from fruit order by name asc');

    // to_char(eaten_on, 'Day') - this returns a day string
    // extract(dow from eaten_on) - this returns a day #

    const eaten = await db.manyOrNone(`
        select *, to_char(eaten_on, 'Day') as day 
            from eaten 
            join fruit 
                on eaten.fruit_id = fruit.id
            join system_user
                on system_user.id = eaten.user_id
        where system_user.id = $1

        `, [req.session.user.id]);

    res.render("index", {
        user: req.session.user,
        eaten,
        fruits
    });
});

app.get('/register', (req, res) => {
    res.render('register');
});

app.post('/register', async (req, res) => {
    let { username } = req.body;

    if (username) {
        // create a unique code foe the user.
        const code = uid();
        username = username.toLowerCase();
        // check if the user is in the database - if so return an error

        const findUserSQL = "select count(*) from system_user where username = $1";
        const result = await db.one(findUserSQL, [username]);

        if (Number(result.count) !== 0) {
            req.flash('error', `Username already exists - ${username}`);
        } else {
            // insert the user in the database...
            const createUserSQL = `insert into system_user (username, code) values ($1, $2)`;
            await db.none(createUserSQL, [username, code]);

            // show a message that the user was added
            req.flash('success', 'User was added - use this code : ' + code);
        }

    } else {
        req.flash('error', 'No username provided');
    }

    res.redirect('/register');

});


app.get('/login', async (req, res) => {
    res.render('login');
});


app.post('/login', async (req, res) => {

    const { code } = req.body;
    if (code) {
        // is the code valid?
        // how do I knw a code is valid...

        const findUserByCodeSQL = `select * from system_user where code = $1`;
        const user = await db.oneOrNone(findUserByCodeSQL, [code]);
        if (user) {
            // if the code is valid store the user in the session
            // if the code is code valid show the login screen?

            // console.log(user);
            req.session.user = user;
            res.redirect('/');
            return;
        }
    }

    req.flash('error', 'Invalid user code');
    res.render('login');


});

app.get('/admin', (req, res) => {
    res.render('admin', {
        username : req.session.user.username
    });
});



const PORT = process.env.PORT | 4009;

app.listen(PORT, () => {

    console.log(`App started on ${PORT}`)
})