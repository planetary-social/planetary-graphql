# planetary-pub2

GraphQL types and resolvers for a planetary public server

## Usage

`npm install -S planetary-pub2`

## API

### Queries

```
# Message Fragment
{
  key
    value {
      previous
      sequence
      author
      timestamp
      hash
      content {
        type
        text
        root
      }
      signature
    }
  }
}
```

```
getPost(key: ID) {
  message {
    ...MessageFragment
  }
  threads {
    ...MessageFragment
  }
  full
}
```

