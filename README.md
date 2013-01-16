# Zencoder

A simple Zencoder client to manage Jobs with Node-style callbacks.

 * Easily extendable, understandable, and modifiable.
 * Monitors job progress with a single `setInterval`. (Very valuable with lots of other requests!)
 *

## Installation

```
npm install zencoder-client
```

## Usage Example

 1. Create a ZencoderClient instance.

    ```
    zenClient = zencoder.createClient({
      key: 'YOUR_API_KEY'
    })
    ```

 1. Using an S3 module like Knox, upload your to-be-encoded file.

    ```
    inputBucket.putFile(pathOnDisk, pathInS3, createZcJob)
    ```

 1. Create the Zencoder Job. (Remember that `createZcJob` is the callback from the previous step!)

    ```
    function createZcJob() {
      zenClient.createJob({
        input: 's3://INPUT_BUCKET' + pathInS3
        outputs: [{
          url: 's3://OUTPUT_BUCKET' + pathInS3
        }]
      }, finalCallback)
    }
    ```

 1. In `finalCallback`, rejoice! The job is complete!
