# Notas de Build

```mermaid
classDiagram
    class LoadAndDrop_01 {
        +dataFrame log_drains
        +Load()
        +Clean()
    }

    class FeatureEng_02 {
        +parquet
        +Load_Parquet()
        +process_features_log_drains()
        +check_for_negatives()
        +save_checkpoint()
    }

    LoadAndDrop_01 --> FeatureEng_02 : output parquet
```
