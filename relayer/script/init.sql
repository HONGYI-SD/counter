CREATE TABLE deposit (
	id            bigserial PRIMARY KEY,
	slot          BIGINT    NOT NULL,
	deposit_index BIGINT NOT NULL,
	user_addr VARCHAR(44) NULL,
	deposit_amount BIGINT NOT NULL,
	leaf_chunk_pda_addr VARCHAR(44) NULL,
	current_merkle_root varchar NULL,
	deposit_item_hash varchar NULL,
	updated_on TIMESTAMP default current_timestamp
);

CREATE TABLE summary (
	id            bigserial PRIMARY KEY,
	slot          BIGINT    NOT NULL,
	leaf_chunk_index BIGINT NOT NULL,
	leaf_chunk_pda_addr VARCHAR(44) NULL,
	pda_merkle_root varchar NULL,
	updated_on TIMESTAMP default current_timestamp
);