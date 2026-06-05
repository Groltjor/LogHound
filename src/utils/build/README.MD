```mermaid
classDiagram
    class build_preprocess_base {
        +metadata dict
        +cols_to_np1log
        +cols_to_yeo
        +cols_to_onehot
        +cols_to_standard
        +cols_to_function
        +return ColumnTransformer
    }

    class ColumnTransformer {
        +log1p: Pipeline
        +maper: Pipeline
        +yeo: Pipeline
        +cat: Pipeline
        +num: Pipeline
        +remainder='drop'
    }

    class log1p_transformer {
        +SimpleImputer(median)
        +FunctionTransformer(np.log1p)
        +StandardScaler()
    }

    class function_map {
        +SimpleImputer(median)
        +FunctionTransformer(astype int)
    }

    class yeo_transformer {
        +SimpleImputer(median)
        +PowerTransformer(yeo-johnson)
        +StandardScaler()
    }

    class onehot_transformer {
        +SimpleImputer(most_frequent)
        +OneHotEncoder(ignore_unknown)
    }

    class numeric_pipeline {
        +SimpleImputer(median)
        +StandardScaler()
    }

    class build_kmeans_from_preprocessor {
        +preprocessor ColumnTransformer
        +n int
        +rd_state int
        +return Pipeline
    }

    class KMeans {
        +n_clusters=n
        +random_state=rd_state
    }

    class TrainingPipeline {
        +preprocessor
        +model
    }

    build_preprocess_base --> ColumnTransformer : builds
    ColumnTransformer *-- log1p_transformer : cols_to_np1log
    ColumnTransformer *-- function_map : cols_to_function
    ColumnTransformer *-- yeo_transformer : cols_to_yeo
    ColumnTransformer *-- onehot_transformer : cols_to_onehot
    ColumnTransformer *-- numeric_pipeline : cols_to_standard

    build_kmeans_from_preprocessor --> TrainingPipeline : builds
    TrainingPipeline *-- ColumnTransformer : preprocessor
    TrainingPipeline *-- KMeans : model
```
