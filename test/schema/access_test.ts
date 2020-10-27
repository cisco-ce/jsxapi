type Role = "Admin" | "User" | "Guest";

type Access<apiAccess extends Role, nodeAccess extends Role, T> =
  Extract<nodeAccess, apiAccess> extends never ? never : T;

type ExistingProps<T> = { [K in keyof T]: T[K] extends never ? never : K }[keyof T];
type FilterProps<T> = { [P in keyof T]: Filter<T[P]> }
type Filter<T> =
  T extends any[] ? T :
  T extends object ? Pick<FilterProps<T>, ExistingProps<T>> :
  T;

type FilterAPI<roles extends Role = never> = Filter<API<roles>>;

interface API<A extends Role> {
  roles: Role[];
  // internal: Access<A, "Admin", boolean>;
  app: Access<A, "Admin", {
    secret: Access<A, "Admin", number>;
  }>,
  /**
   * User session information.
   */
  session: Access<A, "Admin" | "User", {
    username: Access<A, "Admin" | "User", string>;
  }>,
  unprivileged: Access<A, "Admin" | "User" | "Guest", boolean>;
}

const apiData: FilterAPI<any> = {
  roles: ["Admin"],
  app: {
    secret: 1337,
  },
  session: {
    username: "username",
  },
  unprivileged: true,
};

const api = apiData as FilterAPI;

function hasRole<T extends Role>(role: T, api: any): api is FilterAPI<T> {
  // instanceof check?
  return "roles" in api && role in api.roles;
}

console.log('roles', api.roles);
// console.log('secret is', api.app.secret); // Inaccessible here
// console.log('username is', api.session.username); // Inaccessible here
// console.log('unprivileged is', api.unprivileged); // Inaccessible here

if (hasRole("Guest", api)) {
  // console.log('secret is', api.app.secret); // Inaccessible here
  // console.log('username is', api.session.username); // Inaccessible here
  console.log('unprivileged is', api.unprivileged);
}

if (hasRole("User", api)) {
  // console.log('secret is', api.app.secret); // Inaccessible here
  console.log('username is', api.session.username);
  console.log('unprivileged is', api.unprivileged);
}

if (hasRole("Admin", api)) {
  console.log('secret is', api.app.secret);
  console.log('username is', api.session.username);
  console.log('unprivileged is', api.unprivileged);
}
