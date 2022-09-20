// const gql = require('graphql-tag')

// module.exports = gql`
module.exports = `
  type Post {
    message: Message # the root message
    threads: [Message] # the child messages that point to the root message
    full: Boolean # not sure?
  }

  type Message {
    key: String
    value: MessageValue
    timestamp: Int
  }

  type MessageValue {
    previous: String
    sequence: Int
    author: String
    timestamp: Int
    hash: Hash
    content: MessageContent
    signature: String
  }

  type MessageContent {
    type: MessageType
    text: String
    root: String
  }

  enum Hash {
    sha256 # TODO
  }

  enum MessageType {
    post # TODO
  }

  input FeedInput {
    username: String
    feedId: String
    page: Int
  }

  input CountInput {
    username: String
    feedId: String
  }

  type Counts {
    followers: Int
    following: Int
    posts: Int
  }

  type Profile {
    name: String
    publicWebHosting: Boolean
    image: String # blobId
  }

  extend type Query {
    # get a post from its key, or from a child key
    getPost(key: ID): Post
    # getThread(key: ID): Post # NOTE: same as getPost
    
    # get feed of a feedId or username
    getFeed(input: FeedInput): [Post]
    
    # get followers, following and post counts
    getCounts(input: CountInput): Counts

    # get profile of a feedId or username
    getProfile(key: ID): Profile

    # TODO
    # getProfiles() [Profile]
  }

  extend type Mutation {
  }

`
