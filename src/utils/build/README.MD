# Notas de Buil

classDiagram
Load&Drop01 : dataFrame log_drains
Load&Drop01 : Load()
Load&Drop01 : Clean()
Feat&Meta02 : parquet
Feat&Meta02 : Load_Parquet()
Feat&Meta02 : process_features_log_drains()
Feat&Meta02 : check_for_negatives()
Feat&Meta02 : save_checkpoint()
Feat&Meta02 <|-- Load&Drop : step
