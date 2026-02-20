ALTER TABLE public.trainings
ADD CONSTRAINT trainings_station_id_fkey
FOREIGN KEY (station_id) REFERENCES public.stations(id);