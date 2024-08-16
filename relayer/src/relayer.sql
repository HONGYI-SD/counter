-- public.deposit definition

-- Drop table

-- DROP TABLE public.deposit;

CREATE TABLE public.deposit (
	id int4 DEFAULT nextval('leafs_id_seq'::regclass) NOT NULL,
	deposit_index int8 NOT NULL,
	deposit_amount int4 NOT NULL,
	user_addr varchar NULL,
	leaf_chunk_pda_addr varchar NULL,
	current_merkle_root varchar NULL,
	CONSTRAINT leafs_pkey PRIMARY KEY (id)
);

-- public.leaf_chunk_pdas definition

-- Drop table

-- DROP TABLE public.leaf_chunk_pdas;

CREATE TABLE public.leaf_chunk_pdas (
	id serial4 NOT NULL,
	leaf_chunk_pda_addr varchar NULL,
	pda_merkle_root varchar NULL,
	pda_leaf_count int4 NULL,
	CONSTRAINT leaf_chunk_pdas_pkey PRIMARY KEY (id)
);