-- Ejecutar una vez en la base configurada para el proyecto.
-- Los horarios anteriores se asignan al área actual; los cambios históricos previos no se pueden reconstruir.
ALTER TABLE horarios
    ADD COLUMN area_id INT NULL AFTER trabajador_id;

UPDATE horarios AS h
INNER JOIN trabajadores AS t
    ON t.id = h.trabajador_id
SET h.area_id = t.area_id
WHERE h.area_id IS NULL;

CREATE INDEX idx_horarios_area_trabajador
    ON horarios (area_id, trabajador_id);
