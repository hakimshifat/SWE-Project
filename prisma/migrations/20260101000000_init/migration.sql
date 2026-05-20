CREATE TABLE "users" (
  "user_id" SERIAL PRIMARY KEY,
  "username" VARCHAR(100) NOT NULL UNIQUE,
  "email" VARCHAR(150) NOT NULL UNIQUE,
  "password_hash" VARCHAR(255) NOT NULL,
  "role" VARCHAR(20) NOT NULL DEFAULT 'user',
  "status" VARCHAR(20) NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "stego_files" (
  "stego_file_id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "cover_file_name" VARCHAR(255) NOT NULL,
  "stego_file_name" VARCHAR(255) NOT NULL,
  "file_type" VARCHAR(50) NOT NULL,
  "file_size" BIGINT NOT NULL,
  "storage_path" VARCHAR(255) NOT NULL,
  "sha256" VARCHAR(64) NOT NULL,
  "password_protected" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "operation_logs" (
  "log_id" SERIAL PRIMARY KEY,
  "user_id" INTEGER REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE,
  "stego_file_id" INTEGER REFERENCES "stego_files"("stego_file_id") ON DELETE SET NULL ON UPDATE CASCADE,
  "operation_type" VARCHAR(50) NOT NULL,
  "operation_status" VARCHAR(50) NOT NULL,
  "message" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "stego_files_user_id_idx" ON "stego_files"("user_id");
CREATE INDEX "stego_files_sha256_idx" ON "stego_files"("sha256");
CREATE INDEX "operation_logs_user_id_idx" ON "operation_logs"("user_id");
CREATE INDEX "operation_logs_stego_file_id_idx" ON "operation_logs"("stego_file_id");

