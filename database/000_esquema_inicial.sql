-- Estructura vacia: no incluye personas, horarios ni contrasenas.
-- Ejecutar en una base nueva desde el editor SQL de TiDB Cloud.
-- No ejecutar 001_area_historica_horarios.sql despues: area_id ya esta incluida.
CREATE TABLE IF NOT EXISTS areas (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    estado TINYINT DEFAULT 1,
    fecha_creacion TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS trabajadores (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    area_id INT NOT NULL,
    estado TINYINT DEFAULT 1,
    fecha_creacion TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    cargo VARCHAR(50) NOT NULL DEFAULT 'MESERO',
    KEY idx_trabajadores_area (area_id),
    CONSTRAINT fk_trabajadores_area FOREIGN KEY (area_id) REFERENCES areas (id)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS horarios (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    trabajador_id INT NOT NULL,
    area_id INT NULL,
    semana_inicio DATE NOT NULL,
    dia_semana ENUM('Lunes','Martes','Miercoles','Jueves','Viernes','Sabado','Domingo') NOT NULL,
    horario VARCHAR(100) DEFAULT 'LIBRE',
    fecha_actualizacion TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_horario_dia (trabajador_id, semana_inicio, dia_semana),
    KEY idx_horarios_area_trabajador (area_id, trabajador_id),
    CONSTRAINT fk_horarios_trabajador FOREIGN KEY (trabajador_id) REFERENCES trabajadores (id)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
