const fs = require("fs");
const faker = require("faker");
const swagger = require("./swagger.json");

const output = "mirage-server.js";

// https://github.com/you-dont-need/You-Dont-Need-Lodash-Underscore#_get
const get = (obj, path, defaultValue = undefined) => {
  const travel = regexp =>
    String.prototype.split
      .call(path, regexp)
      .filter(Boolean)
      .reduce(
        (res, key) => (res !== null && res !== undefined ? res[key] : res),
        obj
      );
  const result = travel(/[,[\]]+?/) || travel(/[,[\].]+?/);
  return result === undefined || result === obj ? defaultValue : result;
};

const getSchemaFromRef = ref =>
  get(swagger, `definitions.${ref.replace("#/definitions/", "")}`);

const mockDataType = ({ type, format }) => {
  switch (type) {
    case "integer":
      return faker.random.number();
    case "string":
      switch (format) {
        case "date-time":
          return faker.date.recent();
        default:
          return faker.lorem.words();
      }
    case "boolean":
      return faker.random.boolean();
  }
};

const getMockDataFromSchema = ({ type, properties }) => {
  const response = {};
  if (properties) {
    Object.keys(properties).forEach(field => {
      response[field] = mockDataType(properties[field]);
    });
    return response;
  }
};

const generateMirageJsFile = (namespace, endpoints) => {
  const endpointsString = endpoints.reduce((acum, curr) => {
    const { url, endpointMethods, httpMethod, statusCode, response } = curr;
    return `${acum}
		this.${httpMethod}(
			"${url}",
			() => (${JSON.stringify(response, null, 8).replace('}', '			}')}),
			{ timing: 3000 }
		)
`;
  }, "");
  const content = `
import { Server, Response } from "miragejs"

new Server({
  routes() {
    this.namespace = "${namespace}"
    ${endpointsString}
  },
})
`;
  fs.writeFile(output, content, function(err) {
    if (err) return console.log(err);
    console.log(`Enjoy your mocked server ${output}`);
  });
};

(async () => {
  console.log("Creating miragejs mock server based on swagger.json file...");
  const namespace = swagger.basePath;
  const endpoints = [];

  Object.keys(swagger["paths"]).forEach(url => {
    const endpointMethods = swagger["paths"][url];
    Object.keys(endpointMethods).forEach(httpMethod => {
      Object.keys(endpointMethods[httpMethod]["responses"]).forEach(
        statusCode => {
          const ref = get(
            endpointMethods,
            `${httpMethod}.responses.${statusCode}.schema.$ref`
          );
          if (ref) {
            const responseSchema = getSchemaFromRef(ref);
            const response = getMockDataFromSchema(responseSchema);
            endpoints.push({
              url,
              endpointMethods,
              httpMethod,
              statusCode,
              response
            });
          }
        }
      );
    });
  });

  generateMirageJsFile(namespace, endpoints);
})();
