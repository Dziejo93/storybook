import { PackageJson, StorybookConfig } from '@storybook/core-common';
import { computeStorybookMetadata, metaFrameworks } from './storybook-metadata';

const packageJsonMock: PackageJson = {
  name: 'some-user-project',
  version: 'x.x.x',
};

const mainJsMock: StorybookConfig = {
  stories: [],
};

jest.mock('./package-versions', () => {
  const actualPackage = jest.requireActual('./package-versions');
  return {
    ...actualPackage,
    getActualPackageVersion: jest.fn(() => Promise.resolve(packageJsonMock)),
  };
});

// @TODO: separate `getActualVersions` to a file so we can mock it
describe('await computeStorybookMetadata', () => {
  test('should return frameworkOptions from mainjs', async () => {
    const reactResult = await computeStorybookMetadata({
      packageJson: {
        ...packageJsonMock,
        devDependencies: {
          '@storybook/react': 'x.x.x',
        },
      },
      mainConfig: {
        ...mainJsMock,
        reactOptions: {
          fastRefresh: false,
        },
      },
    });

    expect(reactResult.framework).toEqual({ name: 'react', options: { fastRefresh: false } });

    const angularResult = await computeStorybookMetadata({
      packageJson: {
        ...packageJsonMock,
        devDependencies: {
          '@storybook/angular': 'x.x.x',
        },
      },
      mainConfig: {
        ...mainJsMock,
        angularOptions: {
          enableIvy: true,
        },
      },
    });

    expect(angularResult.framework).toEqual({ name: 'angular', options: { enableIvy: true } });
  });

  test('should separate storybook packages and addons', async () => {
    const result = await computeStorybookMetadata({
      packageJson: {
        ...packageJsonMock,
        devDependencies: {
          '@storybook/react': 'x.y.z',
          '@storybook/addon-essentials': 'x.x.x',
          'storybook-addon-deprecated': 'x.x.x',
        },
      },
      mainConfig: {
        ...mainJsMock,
        addons: ['@storybook/addon-essentials', 'storybook-addon-deprecated/register'],
      },
    });

    expect(result.addons).toMatchInlineSnapshot(`
      Object {
        "@storybook/addon-essentials": Object {
          "options": null,
          "version": "6.5.0-alpha.48",
        },
        "storybook-addon-deprecated": Object {
          "options": null,
          "version": null,
        },
      }
    `);
    expect(result.storybookPackages).toMatchInlineSnapshot(`
      Object {
        "@storybook/react": Object {
          "version": "6.5.0-alpha.48",
        },
      }
    `);
  });

  test('should return user specified features', async () => {
    const features = {
      interactionsDebugger: true,
    };

    const result = await computeStorybookMetadata({
      packageJson: packageJsonMock,
      mainConfig: {
        ...mainJsMock,
        features,
      },
    });

    expect(result.features).toEqual(features);
  });

  test('should handle different types of builders', async () => {
    const simpleBuilder = 'webpack4';
    const complexBuilder = {
      name: 'webpack5',
      options: {
        lazyCompilation: true,
      },
    };
    expect(
      (
        await computeStorybookMetadata({
          packageJson: packageJsonMock,
          mainConfig: {
            ...mainJsMock,
            core: {
              builder: complexBuilder,
            },
          },
        })
      ).builder
    ).toEqual(complexBuilder);
    expect(
      (
        await computeStorybookMetadata({
          packageJson: packageJsonMock,
          mainConfig: {
            ...mainJsMock,
            core: {
              builder: simpleBuilder,
            },
          },
        })
      ).builder
    ).toEqual({ name: simpleBuilder, options: null });
  });

  test('should return the number of refs', async () => {
    const res = await computeStorybookMetadata({
      packageJson: packageJsonMock,
      mainConfig: {
        ...mainJsMock,
        refs: {
          a: { title: '', url: '' },
          b: { title: '', url: '' },
        },
      },
    });
    expect(res.refCount).toEqual(2);
  });

  test.each(Object.entries(metaFrameworks))(
    'should detect the supported metaframework: %s',
    async (metaFramework, name) => {
      const res = await computeStorybookMetadata({
        packageJson: {
          ...packageJsonMock,
          dependencies: {
            [metaFramework]: 'x.x.x',
          },
        },
        mainConfig: mainJsMock,
      });
      expect(res.metaFramework).toEqual({
        name,
        packageName: metaFramework,
        version: 'x.x.x',
      });
    }
  );
});