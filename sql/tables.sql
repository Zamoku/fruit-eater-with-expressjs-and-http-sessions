create table system_user (
    id serial PRIMARY KEY,
    username text NOT NULL,
    code text NOT NULL
);

create table fruit (
    id serial PRIMARY KEY,
    name text NOT NULL
);

create table eaten  (
    id serial PRIMARY KEY,
    user_id integer,
    fruit_id integer,
    qty integer,
    eaten_on date not null DEFAULT CURRENT_DATE,
    FOREIGN KEY (fruit_id) REFERENCES fruit(id),
    FOREIGN KEY (user_id) REFERENCES system_user(id)
);